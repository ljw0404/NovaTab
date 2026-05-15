import { motion } from 'framer-motion';

export function ToggleRow(props: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 transition hover:bg-white/10">
      <div className="min-w-0 flex-1 pr-4">
        <div className="text-sm text-white/90">{props.label}</div>
        {props.desc && (
          <div className="mt-0.5 text-xs text-white/50">{props.desc}</div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.value}
        onClick={() => props.onChange(!props.value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          props.value ? 'bg-white/80' : 'bg-white/15'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow ${
            props.value ? 'left-[22px] bg-black/90' : 'left-0.5 bg-white'
          }`}
        />
      </button>
    </div>
  );
}
