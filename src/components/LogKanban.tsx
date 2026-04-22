// src/components/LogKanban.tsx
import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Package, Truck, CheckCircle } from 'lucide-react';

interface Item {
  id: string;
  nome_do_livro: string;
  isbn: string;
  nota_fiscal: string | null;
  quantidade_esperada: number | null;
  quantidade_chegada: number | null;
  previsao_chegada: string | null;
  status: 'devem-ser-enviados' | 'enviados' | 'em-transito' | 'recebidos';
}

const columns = {
  'devem-ser-enviados': { label: 'A enviar', icon: Package },
  'enviados': { label: 'Enviados', icon: Truck },
  'em-transito': { label: 'Em trânsito', icon: Truck },
  'recebidos': { label: 'Recebidos', icon: CheckCircle },
};

export default function LogKanban() {
  const [items, setItems] = useState<Item[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<any>({});
  const { toast } = useToast();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🔊 desbloquear autoplay
  useEffect(() => {
    const unlockAudio = () => {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
      audio.pause();
      audio.currentTime = 0;
    };

    window.addEventListener('click', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
    };
  }, []);

  // 🔊 preload + realtime
  useEffect(() => {
    const audio = new Audio('/notification.mp3');
    audio.preload = 'auto';
    audio.volume = 1;
    audioRef.current = audio;

    loadItems();

    const channel = supabase
      .channel('logistica-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'logistica' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems(prev => [payload.new as Item, ...prev]);

            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          }

          if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev.map(i =>
                i.id === payload.new.id ? (payload.new as Item) : i
              )
            );
          }

          if (payload.eventType === 'DELETE') {
            setItems(prev =>
              prev.filter(i => i.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadItems = async () => {
    const { data } = await supabase
      .from('logistica')
      .select('*')
      .order('created_at', { ascending: false });

    setItems(data || []);
  };

  // ✅ CREATE
  const handleCreate = async () => {
    if (!form.nome_do_livro || !form.isbn) {
      toast({ title: 'Preencha Livro e ISBN' });
      return;
    }

    const { error } = await supabase.from('logistica').insert({
      nome_do_livro: form.nome_do_livro,
      isbn: form.isbn,
      nota_fiscal: form.nota_fiscal || null,
      quantidade_esperada: form.quantidade_esperada ? Number(form.quantidade_esperada) : null,
      quantidade_chegada: form.quantidade_chegada ? Number(form.quantidade_chegada) : null,
      previsao_chegada: form.previsao_chegada || null,
      status: 'devem-ser-enviados',
    });

    if (error) {
      toast({ title: 'Erro', description: error.message });
      return;
    }

    setOpenCreate(false);
    setForm({});
  };

  // ✅ UPDATE
  const handleUpdate = async () => {
    if (!editing) return;

    await supabase
      .from('logistica')
      .update(form)
      .eq('id', editing.id);

    setEditing(null);
  };

  // ✅ DRAG
  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const id = result.draggableId;
    const status = result.destination.droppableId;

    setItems(prev =>
      prev.map(i => i.id === id ? { ...i, status } : i)
    );

    await supabase.from('logistica').update({ status }).eq('id', id);
  };

  return (
    <div className="p-6 space-y-6">

      <Button onClick={() => setOpenCreate(true)}>
        Nova tarefa
      </Button>

      {/* BOARD */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          {Object.entries(columns).map(([key, col]) => {
            const list = items.filter(i => i.status === key);
            const Icon = col.icon;

            return (
              <div key={key} className="bg-muted p-3 rounded-lg">
                <div className="flex items-center gap-2 font-bold mb-3">
                  <Icon className="h-4 w-4" />
                  {col.label} ({list.length})
                </div>

                <Droppable droppableId={key}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3 min-h-[200px]">

                      {list.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(prov) => (
                            <Card
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className="p-3 cursor-pointer hover:shadow-md"
                              onClick={() => {
                                setEditing(item);
                                setForm(item);
                              }}
                            >
                              <div className="font-semibold text-sm">{item.nome_do_livro}</div>
                              <div className="text-xs opacity-60">ISBN: {item.isbn}</div>
                              {item.nota_fiscal && <div className="text-xs">NF: {item.nota_fiscal}</div>}
                            </Card>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}

        </div>
      </DragDropContext>

      {/* CREATE MODAL */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <h2 className="font-bold mb-4">Nova tarefa</h2>

          <Input placeholder="Título do Livro" onChange={e => setForm({ ...form, nome_do_livro: e.target.value })} />
          <Input placeholder="ISBN" onChange={e => setForm({ ...form, isbn: e.target.value })} />
          <Input placeholder="Nota Fiscal" onChange={e => setForm({ ...form, nota_fiscal: e.target.value })} />
          <Input type="number" placeholder="Qtd Esperada" onChange={e => setForm({ ...form, quantidade_esperada: e.target.value })} />
          <Input type="number" placeholder="Qtd Chegada" onChange={e => setForm({ ...form, quantidade_chegada: e.target.value })} />
          <Input type="date" onChange={e => setForm({ ...form, previsao_chegada: e.target.value })} />

          <Button className="mt-4 w-full" onClick={handleCreate}>
            Criar
          </Button>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <h2 className="font-bold mb-4">Editar tarefa</h2>

          <Input value={form.nome_do_livro || ''} onChange={e => setForm({ ...form, nome_do_livro: e.target.value })} />
          <Input value={form.isbn || ''} onChange={e => setForm({ ...form, isbn: e.target.value })} />
          <Input value={form.nota_fiscal || ''} onChange={e => setForm({ ...form, nota_fiscal: e.target.value })} />

          <Button className="mt-4 w-full" onClick={handleUpdate}>
            Salvar
          </Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}