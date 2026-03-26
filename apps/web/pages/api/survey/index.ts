import dbConnect from "@/lib/mongodb";
import { Survey, SurveyVote } from "@/lib/models";
import { csrfProtection } from "@/lib/csrf";
import { createLogger } from "@/lib/logger";

const log = createLogger("Survey");

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// GET - Get active survey (public, no auth required)
	if (req.method === "GET") {
		try {
			const { visitorId } = req.query;

			// Find the active survey
			const survey = await Survey.findOne({ status: "active" }).lean();

			if (!survey) {
				return res.status(200).json({ survey: null });
			}

			// Get vote counts for each choice
			const voteCounts = await SurveyVote.aggregate([
				{ $match: { surveyId: survey._id } },
				{ $group: { _id: "$choiceId", count: { $sum: 1 } } },
			]);

			const voteCountMap = {};
			voteCounts.forEach((v) => {
				voteCountMap[v._id] = v.count;
			});

			// Add vote counts to choices
			const choicesWithCounts = survey.choices.map((choice) => ({
				...choice,
				voteCount: voteCountMap[choice.id] || 0,
			}));

			// Check if this visitor has already voted
			let userVote = null;
			if (visitorId) {
				const existingVote = await SurveyVote.findOne({
					surveyId: survey._id,
					visitorId,
				}).lean();
				if (existingVote) {
					userVote = existingVote.choiceId;
				}
			}

			return res.status(200).json({
				survey: {
					...survey,
					choices: choicesWithCounts,
				},
				userVote,
			});
		} catch (error) {
			log.error("Failed to fetch survey", { error: error.message });
			return res.status(500).json({ error: "Failed to fetch survey" });
		}
	}

	// POST - Submit or update vote (public, no auth required)
	if (req.method === "POST") {
		try {
			const { surveyId, choiceId, visitorId } = req.body;

			if (!surveyId || !choiceId || !visitorId) {
				return res.status(400).json({
					error: "Survey ID, choice ID, and visitor ID are required",
				});
			}

			// Validate visitor ID format (should be a UUID-like string)
			if (visitorId.length < 10 || visitorId.length > 100) {
				return res.status(400).json({ error: "Invalid visitor ID" });
			}

			// Find the survey and verify it's active
			const survey = await Survey.findById(surveyId);
			if (!survey) {
				return res.status(404).json({ error: "Survey not found" });
			}
			if (survey.status !== "active") {
				return res.status(400).json({ error: "Survey is not active" });
			}

			// Verify the choice exists
			const choiceExists = survey.choices.some((c) => c.id === choiceId);
			if (!choiceExists) {
				return res.status(400).json({ error: "Invalid choice" });
			}

			// Upsert the vote (create or update)
			const vote = await SurveyVote.findOneAndUpdate(
				{ surveyId, visitorId },
				{ surveyId, visitorId, choiceId },
				{ upsert: true, new: true }
			);

			return res.status(200).json({
				success: true,
				vote: {
					choiceId: vote.choiceId,
				},
			});
		} catch (error) {
			log.error("Failed to submit survey vote", { surveyId: req.body.surveyId, error: error.message });
			return res.status(500).json({ error: "Failed to submit vote" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
