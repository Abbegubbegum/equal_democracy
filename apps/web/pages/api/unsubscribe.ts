import dbConnect from "@/lib/mongodb";
import { User } from "@/lib/models";

export default async function handler(req, res) {
	const { email } = req.query;

	if (!email) {
		return res.status(400).send(htmlPage("Missing email parameter", false));
	}

	await dbConnect();

	if (req.method === "GET") {
		// Show confirmation page
		return res.status(200).send(htmlPage(email, false));
	}

	if (req.method === "POST") {
		try {
			const user = await User.findOneAndUpdate(
				{ email: email.toLowerCase() },
				{ emailOptOut: true },
				{ new: true }
			);

			if (!user) {
				return res.status(404).send(htmlPage(email, false, "User not found"));
			}

			return res.status(200).send(htmlPage(email, true));
		} catch {
			return res
				.status(500)
				.send(htmlPage(email, false, "Something went wrong. Please try again."));
		}
	}

	return res.status(405).send("Method not allowed");
}

function htmlPage(email, success, error = null) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe - Equal Democracy</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 480px; width: 90%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #64748b; line-height: 1.6; }
    .btn { display: inline-block; padding: 12px 32px; background: #dc2626; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; text-decoration: none; margin-top: 16px; }
    .btn:hover { background: #b91c1c; }
    .success { color: #16a34a; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <div class="card">
    ${
		success
			? `<h1 class="success">Unsubscribed</h1>
         <p>You have been unsubscribed from Equal Democracy emails. You will no longer receive non-essential emails.</p>
         <p style="font-size:13px;margin-top:24px">Login codes will still be sent when you sign in.</p>`
			: error
			? `<h1 class="error">Error</h1><p>${error}</p>`
			: `<h1>Unsubscribe</h1>
         <p>Are you sure you want to unsubscribe <strong>${email}</strong> from Equal Democracy emails?</p>
         <p style="font-size:13px">You will still receive login codes when signing in.</p>
         <form method="POST" action="/api/unsubscribe?email=${encodeURIComponent(email)}">
           <button type="submit" class="btn">Unsubscribe</button>
         </form>`
	}
  </div>
</body>
</html>`;
}
