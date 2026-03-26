import dbConnect from "@/lib/mongodb";
import { Survey, SurveyVote } from "@/lib/models";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { csrfProtection } from "@/lib/csrf";
import { hasAdminAccess } from "@/lib/admin-helper";
import { createLogger } from "@/lib/logger";

const log = createLogger("AdminSurvey");

export default async function handler(req, res) {
	await dbConnect();

	// CSRF protection for state-changing methods
	if (!csrfProtection(req, res)) {
		return;
	}

	// Check if user has admin access
	const session = await getServerSession(req, res, authOptions);
	if (!session || !hasAdminAccess(session.user)) {
		return res.status(403).json({ error: "Unauthorized" });
	}

	// GET - Get all surveys
	if (req.method === "GET") {
		try {
			const surveys = await Survey.find()
				.populate("createdBy", "name email")
				.sort({ createdAt: -1 })
				.lean();

			// Get vote counts for each survey
			for (const survey of surveys) {
				const voteCounts = await SurveyVote.aggregate([
					{ $match: { surveyId: survey._id } },
					{ $group: { _id: "$choiceId", count: { $sum: 1 } } },
				]);

				const voteCountMap = {};
				let totalVotes = 0;
				voteCounts.forEach((v) => {
					voteCountMap[v._id] = v.count;
					totalVotes += v.count;
				});

				survey.choices = survey.choices.map((choice) => ({
					...choice,
					voteCount: voteCountMap[choice.id] || 0,
				}));
				survey.totalVotes = totalVotes;
			}

			return res.status(200).json(surveys);
		} catch (error) {
			log.error("Failed to fetch surveys", { error: error.message });
			return res.status(500).json({ error: "Failed to fetch surveys" });
		}
	}

	// POST - Create new survey
	if (req.method === "POST") {
		try {
			const { question, choices } = req.body;

			if (!question || !question.trim()) {
				return res.status(400).json({ error: "Question is required" });
			}

			if (!choices || !Array.isArray(choices) || choices.length < 2 || choices.length > 5) {
				return res.status(400).json({
					error: "Between 2 and 5 choices are required",
				});
			}

			// Validate choices
			for (const choice of choices) {
				if (!choice.text || !choice.text.trim()) {
					return res.status(400).json({ error: "All choices must have text" });
				}
			}

			// Generate IDs for choices
			const choicesWithIds = choices.map((choice, index) => ({
				id: `choice_${Date.now()}_${index}`,
				text: choice.text.trim(),
			}));

			// Close any existing active survey
			await Survey.updateMany(
				{ status: "active" },
				{ status: "closed" }
			);

			// Create new survey
			const newSurvey = await Survey.create({
				question: question.trim(),
				choices: choicesWithIds,
				status: "active",
				createdBy: session.user.id,
			});

			return res.status(201).json(newSurvey);
		} catch (error) {
			log.error("Failed to create survey", { error: error.message });
			return res.status(500).json({ error: "Failed to create survey" });
		}
	}

	// PATCH - Update survey (question, choices, or status)
	if (req.method === "PATCH") {
		try {
			const { id, updates } = req.body;

			if (!id) {
				return res.status(400).json({ error: "Survey ID is required" });
			}

			const survey = await Survey.findById(id);
			if (!survey) {
				return res.status(404).json({ error: "Survey not found" });
			}

			// If setting to active, close other active surveys
			if (updates.status === "active") {
				await Survey.updateMany(
					{ _id: { $ne: id }, status: "active" },
					{ status: "closed" }
				);
			}

			// Update survey
			const updatedSurvey = await Survey.findByIdAndUpdate(
				id,
				updates,
				{ new: true, runValidators: true }
			);

			return res.status(200).json(updatedSurvey);
		} catch (error) {
			log.error("Failed to update survey", { error: error.message });
			return res.status(500).json({ error: "Failed to update survey" });
		}
	}

	// DELETE - Delete a survey and its votes
	if (req.method === "DELETE") {
		try {
			const { id } = req.body;

			if (!id) {
				return res.status(400).json({ error: "Survey ID is required" });
			}

			const survey = await Survey.findById(id);
			if (!survey) {
				return res.status(404).json({ error: "Survey not found" });
			}

			// Delete all votes for this survey
			await SurveyVote.deleteMany({ surveyId: id });

			// Delete the survey
			await Survey.findByIdAndDelete(id);

			return res.status(200).json({ success: true });
		} catch (error) {
			log.error("Failed to delete survey", { error: error.message });
			return res.status(500).json({ error: "Failed to delete survey" });
		}
	}

	return res.status(405).json({ error: "Method not allowed" });
}
