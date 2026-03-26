import connectDB from "../../../lib/mongodb";
import { Proposal, Comment, ThumbsUp, FinalVote } from "../../../lib/models";
import { requireAdmin } from "../../../lib/admin";
import { createLogger } from "../../../lib/logger";

const log = createLogger("AdminProposals");

export default async function handler(req, res) {
	await connectDB();
	const session = await requireAdmin(req, res);
	if (!session) return;

	try {
		if (req.method === "GET") {
			const data = await Proposal.find().sort({ createdAt: -1 }).lean();
			return res.status(200).json(
				data.map((p) => ({
					id: p._id.toString(),
					title: p.title,
					problem: p.problem,
					solution: p.solution,
					estimatedCost: p.estimatedCost,
					description: p.description, // Legacy field
					status: p.status,
					thumbsUpCount: p.thumbsUpCount,
					authorId: p.authorId?.toString?.() || null,
					createdAt: p.createdAt,
				}))
			);
		}

		if (req.method === "POST") {
			const {
				title,
				description,
				status = "active",
				authorId,
				authorName,
			} = req.body;
			if (!title || !description || !authorId || !authorName) {
				return res.status(400).json({
					message:
						"title, description, authorId, authorName is required",
				});
			}
			const p = await Proposal.create({
				title,
				description,
				status,
				authorId,
				authorName,
				thumbsUpCount: 0,
			});
			return res.status(201).json({ id: p._id.toString() });
		}

		if (req.method === "PATCH") {
			const { id, updates } = req.body;
			if (!id || typeof updates !== "object")
				return res
					.status(400)
					.json({ message: "id and updates ir required" });
			const allowed = [
				"title",
				"description",
				"problem",
				"solution",
				"estimatedCost",
				"status",
				"thumbsUpCount",
			];
			const $set = Object.fromEntries(
				Object.entries(updates).filter(([k]) => allowed.includes(k))
			);
			const p = await Proposal.findByIdAndUpdate(
				id,
				{ $set },
				{ new: true }
			);
			if (!p)
				return res.status(404).json({ message: "Proposal not found" });
			return res.status(200).json({ id: p._id.toString() });
		}

		if (req.method === "DELETE") {
			const { id } = req.query;
			if (!id) return res.status(400).json({ message: "id is required" });
			await Promise.all([
				Comment.deleteMany({ proposalId: id }),
				ThumbsUp.deleteMany({ proposalId: id }),
				FinalVote.deleteMany({ proposalId: id }),
			]);
			await Proposal.findByIdAndDelete(id);
			return res.status(204).end();
		}

		return res.status(405).json({ message: "Method not allowed" });
	} catch (e) {
		log.error("Operation failed", { method: req.method, error: e.message });
		return res.status(500).json({ message: "An error has occured" });
	}
}
