import { useRouter } from "next/router";

const ITEMS = [
  { key: "overview", label: "Översikt", href: "/admin/my-questions" },
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
  active: "overview" | "municipal" | "budget";
}) {
  const router = useRouter();

  return (
    <div className="mb-6 flex gap-2">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => router.push(item.href)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            active === item.key
              ? "bg-primary-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
