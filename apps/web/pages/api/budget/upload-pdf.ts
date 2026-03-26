import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import connectDB from "../../../lib/mongodb";
import { User } from "../../../lib/models";
import { extractBudgetFromPDF, generateCategoryColor } from "../../../lib/budget/ai-extractor";
import formidable from "formidable";
import fs from "fs";
import { createLogger } from "@/lib/logger";

const log = createLogger("BudgetUploadPDF");

// Disable default body parser to handle file upload
export const config = {
	api: {
		bodyParser: false,
	},
};

export default async function handler(req, res) {
	await connectDB();

	if (req.method !== "POST") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	const session = await getServerSession(req, res, authOptions);

	if (!session) {
		return res.status(401).json({ message: "You must be logged in" });
	}

	const user = await User.findById(session.user.id);

	if (!user) {
		return res.status(404).json({ message: "User not found" });
	}

	// Only superadmins can upload PDFs
	if (!user.isSuperAdmin) {
		return res.status(403).json({ message: "Superadmin access required" });
	}

	try {
		// Parse the multipart form data
		const form = formidable({
			maxFileSize: 10 * 1024 * 1024, // 10MB max
		});

		const [fields, files] = await new Promise((resolve, reject) => {
			form.parse(req, (err, parsedFields, parsedFiles) => {
				if (err) reject(err);
				resolve([parsedFields, parsedFiles]);
			});
		});

		const pdfFile = files.pdf?.[0];
		const documentType = fields.documentType?.[0] || "expenses";

		if (!pdfFile) {
			return res.status(400).json({ message: "No PDF file uploaded" });
		}

		// Validate file type
		if (pdfFile.mimetype !== "application/pdf") {
			return res.status(400).json({ message: "File must be a PDF" });
		}

		// Read the PDF file
		const pdfBuffer = fs.readFileSync(pdfFile.filepath);

		// Extract budget data using AI
		const extractedData = await extractBudgetFromPDF(pdfBuffer, documentType);

		// Add colors to categories
		if (extractedData.categories) {
			extractedData.categories = extractedData.categories.map((cat, idx) => ({
				...cat,
				color: generateCategoryColor(idx, extractedData.categories.length, "expense"),
			}));
		}

		if (extractedData.incomeCategories) {
			extractedData.incomeCategories = extractedData.incomeCategories.map((cat, idx) => ({
				...cat,
				color: generateCategoryColor(idx, extractedData.incomeCategories.length, "income"),
			}));
		}

		// Clean up temporary file
		fs.unlinkSync(pdfFile.filepath);

		return res.status(200).json({
			message: "PDF processed successfully",
			data: extractedData,
		});
	} catch (error) {
		log.error("Failed to process budget PDF", { error: error.message });
		return res.status(500).json({
			message: "Failed to process PDF",
			error: error.message,
		});
	}
}
