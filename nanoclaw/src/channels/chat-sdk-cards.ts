/**
 * Renderização de display cards (content.type === 'card') no formato do Chat SDK.
 */
import { Actions, Card, CardText, LinkButton, type CardElement } from 'chat';

export interface DisplayCardInput {
  title?: string;
  description?: string;
  children?: string[];
  actions?: Array<{ label: string; url?: string }>;
}

export function hasDisplayCardBody(card: DisplayCardInput): boolean {
  if (card.title?.trim()) return true;
  if (card.description?.trim()) return true;
  if (card.children?.some((line) => line.trim())) return true;
  if (card.actions?.some((action) => action.url)) return true;
  return false;
}

export function buildDisplayCard(cardInput: DisplayCardInput) {
  const children: ReturnType<typeof CardText>[] = [];
  if (cardInput.description) children.push(CardText(cardInput.description));
  for (const line of cardInput.children ?? []) {
    if (line) children.push(CardText(line));
  }
  const linkActions = (cardInput.actions ?? []).filter((action) => action.url);
  if (linkActions.length > 0) {
    children.push(Actions(linkActions.map((action) => LinkButton({ label: action.label, url: action.url! }))));
  }
  // O SDK tipa postMessage com CardElement; o elemento construído aqui é compatível em runtime.
  return Card({ title: cardInput.title ?? '', children }) as unknown as CardElement;
}
