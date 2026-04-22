import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronsUpDown, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
}

interface MemberAssigneeProps {
  capituloId: string;
  currentAssigneeId: string | null;
  onAssigneeUpdated: () => void;
}

export function MemberAssignee({ capituloId, currentAssigneeId, onAssigneeUpdated }: MemberAssigneeProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email').order('full_name');
    if (data) setMembers(data);
  };

  const handleAssign = async (memberId: string) => {
    const newId = memberId === currentAssigneeId ? null : memberId;
    const { error } = await supabase.from('chapter_submissions').update({ assigned_to: newId }).eq('id', capituloId);

    if (!error) {
      onAssigneeUpdated();
      setOpen(false);
      toast({ title: newId ? "Responsável atribuído" : "Atribuição removida" });
    }
  };

  const selectedMember = members.find((m) => m.id === currentAssigneeId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer group">
          {selectedMember ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-transparent group-hover:ring-[#ffb319] transition-all">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedMember.email}`} />
                    <AvatarFallback className="bg-[#ffb319]/10 text-[#ffb319] text-[10px] font-bold">
                      {selectedMember.full_name?.substring(0, 2).toUpperCase() || "EP"}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[10px] font-bold uppercase">{selectedMember.full_name || selectedMember.email}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-dashed border-2 hover:border-[#ffb319] hover:bg-[#ffb319]/5">
              <UserPlus className="h-3 w-3 opacity-40" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 rounded-2xl border-border shadow-2xl" align="start">
        <Command className="rounded-2xl">
          <CommandInput placeholder="Buscar membro..." className="h-9 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-[10px] font-bold uppercase text-center opacity-50">Ninguém encontrado</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem key={member.id} onSelect={() => handleAssign(member.id)} className="text-xs font-medium cursor-pointer py-2">
                  <div className="flex items-center gap-2 w-full">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.email}`} />
                      <AvatarFallback className="text-[8px]">{member.full_name?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{member.full_name || member.email}</span>
                    {currentAssigneeId === member.id && <Check className="h-3 w-3 text-[#ffb319]" />}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}