import connectDB from "../../../lib/mongodb";
import { Comment, Proposal } from "../../../lib/models";
import { requireAdmin } from "../../../lib/admin";
import { validateObjectId, toObjectId } from "../../../lib/validation";
import { csrfProtection } from "../../../lib/csrf";
import { createLogger } from "../../../lib/logger";

const log = createLogger("AdminComments");

export default async function handler(req, res) {
	await connectDB();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	const session = await requireAdmin(req, res);
	if (!session) return;

	try {
		if (req.method === "GET") {
			const { proposalId, userId } = req.query;
			const filter = {};

			if (proposalId) {
				if (!validateObjectId(proposalId)) {
					return res
						.status(400)
						.json({ message: "Invalid proposalId format" });
				}
				filter.proposalId = toObjectId(proposalId);
			}

			if (userId) {
				if (!validateObjectId(userId)) {
					return res
						.status(400)
						.json({ message: "Invalid userId format" });
				}
				filter.userId = toObjectId(userId);
			}

			const data = await Comment.find(filter)
				.sort({ createdAt: -1 })
				.lean();

			// Collect proposal ids and build title map
			const proposalIds = [
				...new Set(
					data.map((c) => c.proposalId?.toString?.()).filter(Boolean)
				),
			];

			const proposals = proposalIds.length
				? await Proposal.find({ _id: { $in: proposalIds } })
						.select("title")
						.lean()
				: [];

			const proposalTitleById = Object.fromEntries(
				proposals.map((p) => [p._id.toString(), p.title])
			);

			return res.status(200).json(
				data.map((c) => ({
					id: c._id.toString(),
					proposalId: c.proposalId?.toString?.() || null,
					proposalTitle:
						proposalTitleById[c.proposalId?.toString?.()] || null,
					userId: c.userId?.toString?.() || null,
					authorName: c.authorName,
					text: c.text,
					createdAt: c.createdAt,
				}))
			);
		}

		if (req.method === "DELETE") {
			const { id } = req.query;
			if (!id || !validateObjectId(id)) {
				return res.status(400).json({ message: "Invalid comment ID" });
			}
			await Comment.findByIdAndDelete(toObjectId(id));
			return res.status(204).end();
		}

		return res.status(405).json({ message: "Method not allowed" });
	} catch (e) {
		log.error("Operation failed", { method: req.method, error: e.message });
		return res.status(500).json({ message: "An error has occured" });
	}
}
