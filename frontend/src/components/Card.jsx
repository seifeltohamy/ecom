import { S } from '../styles.js';

export function CardTitle({ children }) {
  return <div style={S.cardTitle}>{children}</div>;
}

export default function Card({ children, style }) {
  return <div style={{ ...S.card, ...style }}>{children}</div>;
}
