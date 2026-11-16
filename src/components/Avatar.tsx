import { colorFor, initials } from "@/lib/avatar";

export default function Avatar({
  name,
  color,
  size = 28,
  ring = false,
}: {
  name: string;
  color?: string | null;
  size?: number;
  ring?: boolean;
}) {
  return (
    <div
      title={name}
      style={{
        background: color || colorFor(name),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
      }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        ring ? "ring-2 ring-white" : ""
      }`}
    >
      {initials(name)}
    </div>
  );
}
