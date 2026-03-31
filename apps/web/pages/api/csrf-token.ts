import type { NextApiRequest, NextApiResponse } from "next";
import { getCsrfToken } from "../../lib/csrf";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "GET") {
		return res.status(405).json({ message: "Method not allowed" });
	}

	const token = getCsrfToken(req, res);

	return res.status(200).json({ csrfToken: token });
}
