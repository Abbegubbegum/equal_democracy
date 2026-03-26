import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { Proposal, ThumbsUp, Comment, FinalVote } from "../../../lib/models";
import { createLogger } from "@/lib/logger";

const log = createLogger("UserActivity");

export default async function handler(req, res) {
	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You have to be logged in" });
	}

	await connectDB();

	try {
		const userId = session.user.id;

		const myProposals = await Proposal.find({ authorId: userId })
			.sort({ createdAt: -1 })
			.lean();

		const myThumbsUps = await ThumbsUp.find({ userId })
			.populate("proposalId")
			.sort({ createdAt: -1 })
			.lean();

		const myComments = await Comment.find({ userId })
			.populate("proposalId")
			.sort({ createdAt: -1 })
			.lean();

		const myVotes = await FinalVote.find({ userId })
			.populate("proposalId")
			.sort({ createdAt: -1 })
			.lean();

		const activity = {
			proposals: myProposals.map((p) => ({
				_id: p._id.toString(),
				title: p.title,
				description: p.description,
				status: p.status,
				thumbsUpCount: p.thumbsUpCount,
				createdAt: p.createdAt,
			})),
			thumbsUps: myThumbsUps
				.filter((t) => t.proposalId)
				.map((t) => ({
					_id: t._id.toString(),
					proposalTitle: t.proposalId.title,
					proposalId: t.proposalId._id.toString(),
					createdAt: t.createdAt,
				})),
			comments: myComments
				.filter((c) => c.proposalId)
				.map((c) => ({
					_id: c._id.toString(),
					text: c.text,
					proposalTitle: c.proposalId.title,
					proposalId: c.proposalId._id.toString(),
					createdAt: c.createdAt,
				})),
			finalVotes: myVotes
				.filter((v) => v.proposalId)
				.map((v) => ({
					_id: v._id.toString(),
					choice: v.choice,
					proposalTitle: v.proposalId.title,
					proposalId: v.proposalId._id.toString(),
					createdAt: v.createdAt,
				})),
		};

		return res.status(200).json(activity);
	} catch (error) {
		log.error("Failed to fetch user activity", { error: error.message });
		return res.status(500).json({ message: "An error has occured" });
	}
}
