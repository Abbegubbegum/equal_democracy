import { useRouter } from "next/router";

const ITEMS = [
  {
    key: "municipal",
    label: "Kallelser",
    href: "/admin/my-questions/municipal",
  },
  { key: "budget", label: "Budget", href: "/admin/my-questions/budget" },
];

export default function MyQuestionsSubNav({
  active,
}: {
  active: "municipal" | "budget";
}) {
  const router = useRouter();

  return (
    <div className="mb-6 flex gap-2 flex-wrap">
      <button
        onClick={() => router.push("/manage-content")}
        className="px-3.5 py-2 rounded-btn text-sm font-bold bg-white border border-black/5 text-gray-600 hover:bg-[#fafbfe] transition-colors"
      >
        ← Hantera innehåll
      </button>
      {ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => router.push(item.href)}
          className={`px-3.5 py-2 rounded-btn text-sm font-bold transition-colors ${
            active === item.key
              ? "bg-primary-600 text-white"
              : "bg-white border border-black/5 text-gray-600 hover:bg-[#fafbfe]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
