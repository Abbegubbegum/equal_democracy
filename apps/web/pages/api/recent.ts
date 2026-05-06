import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import connectDB from "@/lib/mongodb";
import {
	Session,
	CitizenProposal,
	BudgetSession,
	MunicipalSession,
	TopProposal,
	BudgetArgument,
} from "@/lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/recent");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "GET") return res.status(405).end();

	const session = await getServerSession(req, res, authOptions);
	if (!session) return res.status(401).json({ error: "Unauthorized" });

	try {
		await connectDB();

		const [sessions, ideas, budgets, municipals, winners, debateArgs] = await Promise.all([
			Session.find({ status: "active", sessionType: { $nin: ["municipal"] } })
				.sort({ createdAt: -1 })
				.limit(6)
				.select("place sessionType createdAt _id")
				.lean(),
			CitizenProposal.find()
				.sort({ createdAt: -1 })
				.limit(6)
				.select("title createdAt _id")
				.lean(),
			BudgetSession.find()
				.sort({ createdAt: -1 })
				.limit(6)
				.select("name createdAt sessionId")
				.lean(),
			MunicipalSession.find()
				.sort({ createdAt: -1 })
				.limit(6)
				.select("name municipality createdAt _id")
				.lean(),
			TopProposal.find()
				.sort({ archivedAt: -1 })
				.limit(6)
				.select("title sessionPlace archivedAt createdAt _id")
				.lean(),
			BudgetArgument.find({ isHidden: false })
				.sort({ createdAt: -1 })
				.limit(6)
				.select("sessionId categoryName direction createdAt")
				.lean(),
		]);

		const candidates = [
			...debateArgs.map((a) => ({
				type: "debate",
				icon: "💬",
				title: `${a.direction === "up" ? "Höj" : "Sänk"} ${a.categoryName}`,
				subtitle: "Budgetdebatt",
				date: a.createdAt,
				link: `/budget/debate/${a.sessionId}`,
			})),
			...sessions.map((s) => ({
				type: "session",
				icon: s.sessionType === "voting" ? "📱" : "🗳️",
				title: s.place,
				subtitle:
					s.sessionType === "voting"
						? "Röstning · svara i appen"
						: s.sessionType === "survey"
						? "Enkät"
						: "Omröstning",
				date: s.createdAt,
				link: s.sessionType === "voting" ? "#" : `/session/${s._id}`,
			})),
			...ideas.map((i) => ({
				type: "idea",
				icon: "💡",
				title: i.title,
				subtitle: "Idé",
				date: i.createdAt,
				link: "/medborgarforslag",
			})),
			...budgets.map((b) => ({
				type: "budget",
				icon: "📊",
				title: b.name,
				subtitle: "Budget",
				date: b.createdAt,
				link: `/budget/${b.sessionId}`,
			})),
			...municipals.map((m) => ({
				type: "municipal",
				icon: "🏛️",
				title: m.name,
				subtitle: "Kommunen",
				date: m.createdAt,
				link: "/vallentuna",
			})),
			...winners.map((w) => ({
				type: "winner",
				icon: "🏆",
				title: w.title,
				subtitle: `Vinnande förslag · ${w.sessionPlace}`,
				date: w.archivedAt || w.createdAt,
				link: "/archive",
			})),
		];

		candidates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

		return res.status(200).json(candidates.slice(0, 6));
	} catch (error) {
		log.error("Failed to fetch recent items", { error: error.message });
		return res.status(500).json({ error: "Failed to fetch recent items" });
	}
}
