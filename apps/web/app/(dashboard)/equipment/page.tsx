export default function EquipmentPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1
          className="font-display font-semibold uppercase leading-none text-[var(--bone)]"
          style={{ fontSize: 32, letterSpacing: "0.04em", marginBottom: 6 }}
        >
          Equipment
        </h1>
        <p className="font-body text-[var(--bone-dim)]">
          Inventory, inspections, and maintenance tracking.
        </p>
      </div>
      <div
        className="flex items-center justify-center"
        style={{
          border: "1px solid var(--rule-2)",
          background: "var(--steel)",
          padding: "48px 24px",
          borderRadius: 2,
        }}
      >
        <span
          className="font-mono text-[12px] tracking-[0.14em] uppercase"
          style={{ color: "#7a786f" }}
        >
          Coming soon
        </span>
      </div>
    </div>
  );
}
