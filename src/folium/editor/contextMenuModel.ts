// Voci del clic destro nel testo, decise solo dallo stato della selezione. Funzione pura.

export interface TextContext {
  /** c'e' del testo selezionato */
  selection: boolean;
  /** il cursore o la selezione stanno su un link */
  inLink: boolean;
  /** c'e' gia' un commento sul punto cliccato */
  onComment: boolean;
}

export interface TextMenuItem {
  id: 'comment.add' | 'comment.open' | 'edit.link' | 'edit.unlink' | 'edit.cut' | 'edit.copy' | 'edit.paste';
  disabled?: boolean;
  /** linea di separazione prima della voce */
  sep?: boolean;
}

export function textMenuItems(c: TextContext): TextMenuItem[] {
  const out: TextMenuItem[] = [];
  // un solo modo di commentare: sulla selezione, oppure nel punto del cursore
  if (c.onComment && !c.selection) out.push({ id: 'comment.open' });
  else out.push({ id: 'comment.add' });
  out.push({ id: 'edit.link' });
  if (c.inLink) out.push({ id: 'edit.unlink' });
  out.push({ id: 'edit.cut', disabled: !c.selection, sep: true }, { id: 'edit.copy', disabled: !c.selection }, { id: 'edit.paste' });
  return out;
}
