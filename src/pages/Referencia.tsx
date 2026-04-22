import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import {
  Search, Copy, Download, BookText, CheckCircle2, ChevronRight,
} from 'lucide-react';

// ── NOVA PALETA (CORRIGIDA) ───────────────────────────────────
const C = {
  bg: '#fcfcfc',
  primary: '#003223',
  accent: '#ff6400',
  soft: '#f5ebe1',
  highlight: '#bcc850',

  text: '#1a1a1a',
  textMid: 'rgba(0,0,0,0.65)',
  textLow: 'rgba(0,0,0,0.12)',

  white: '#ffffff',
};

// ── TYPES ─────────────────────────────────────────────────────
interface MaterialType { label: string; value: string }
interface ReferenceFields { [key: string]: string }

const materialTypes: MaterialType[] = [
  { label: 'Livro', value: 'book' },
  { label: 'Website', value: 'website' },
];

// ── HELPERS ───────────────────────────────────────────────────
const formatReference = (fields: ReferenceFields) => {
  return `${fields.autor || ''}. ${fields.titulo || ''}. ${fields.ano || ''}`;
};

const fieldLabel = (field: string) =>
  field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// ── COMPONENT ─────────────────────────────────────────────────
const Referencia: React.FC = () => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MaterialType | null>(null);
  const [filteredTypes, setFilteredTypes] = useState<MaterialType[]>([]);
  const [fields, setFields] = useState<ReferenceFields>({});
  const [formattedReference, setFormattedReference] = useState('');
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    if (selected) {
      setFormattedReference(formatReference(fields));
    }
  }, [fields, selected]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setFilteredTypes(
      v ? materialTypes.filter(m => m.label.toLowerCase().includes(v.toLowerCase())) : []
    );
  };

  const handleSelect = (item: MaterialType) => {
    setSelected(item);
    setQuery(item.label);
    setFilteredTypes([]);
    setFields({});
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copiado!' });
  };

  const handleDownload = async () => {
    const doc = new Document({
      sections: [{
        children: [new Paragraph({
          children: [new TextRun(formattedReference)],
        })],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'referencia.docx');
  };

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      <div className="max-w-6xl mx-auto p-6 grid lg:grid-cols-2 gap-6">

        {/* LEFT */}
        <div className="bg-white rounded-2xl p-6 border" style={{ borderColor: C.textLow }}>
          
          {/* SEARCH */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-3 w-4 h-4" style={{ color: C.textMid }} />
            <Input
              value={query}
              onChange={handleQueryChange}
              placeholder="Buscar tipo..."
              className="pl-10 h-12 text-black placeholder:text-gray-400"
            />

            {filteredTypes.length > 0 && (
              <div className="absolute w-full mt-2 bg-white border rounded-xl shadow-lg z-10">
                {filteredTypes.map(item => (
                  <button
                    key={item.value}
                    onClick={() => handleSelect(item)}
                    className="w-full flex justify-between px-4 py-3 text-left text-sm transition"
                    style={{ color: C.text }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = C.soft;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {item.label}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FORM */}
          {selected ? (
            <div className="space-y-4">
              {['autor', 'titulo', 'ano'].map(field => (
                <div key={field}>
                  <label className="text-xs font-bold" style={{ color: C.textMid }}>
                    {fieldLabel(field)}
                  </label>
                  <Input
                    value={fields[field] || ''}
                    onChange={e => setFields({ ...fields, [field]: e.target.value })}
                    className="mt-1 h-11 text-black"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <BookText className="mx-auto mb-3 opacity-30" size={32} />
              <p style={{ color: C.textMid }}>Selecione um tipo</p>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div
          className="rounded-2xl p-6 flex flex-col justify-between"
          style={{
            background: C.primary,
            color: 'white',
          }}
        >
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full" style={{ background: C.accent }} />
              <span className="text-xs uppercase tracking-widest opacity-70">
                Preview
              </span>
            </div>

            <div className="bg-white/10 rounded-xl p-4 min-h-[120px]">
              {formattedReference ? (
                <p className="italic">{formattedReference}</p>
              ) : (
                <p className="opacity-40">Preencha os dados...</p>
              )}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={handleCopy}
              disabled={!formattedReference}
              className="h-11 rounded-xl text-sm font-bold transition"
              style={{
                background: C.bg,
                color: C.primary,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = C.soft;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = C.bg;
              }}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>

            <button
              onClick={handleDownload}
              disabled={!formattedReference}
              className="h-11 rounded-xl text-sm font-bold transition border"
              style={{
                background: '#ffffff',
                color: C.text,
                borderColor: C.textLow,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = C.soft;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <Download className="inline mr-1 w-4 h-4" />
              DOCX
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Referencia;