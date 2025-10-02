export function Card(props:{children:any, header?:string, footer?:any}) {
  return (
    <div className="card">
      {props.header && <div className="header">{props.header}</div>}
      <div className="body">{props.children}</div>
      {props.footer && <div className="footer">{props.footer}</div>}
    </div>
  );
}
export const Btn = (p:React.ButtonHTMLAttributes<HTMLButtonElement> & {variant?:'primary'|'danger'}) =>
  <button {...p} className={`btn ${p.variant==='primary'?'btn-primary':''} ${p.variant==='danger'?'btn-danger':''} ${p.className||''}`} />;
export const Field = (p:{label:string; children:React.ReactNode}) => (
  <label className="stack"><span className="label">{p.label}</span>{p.children}</label>
);
