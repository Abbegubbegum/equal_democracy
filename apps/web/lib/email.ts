import { Resend } from "resend";
import { t } from "./locales";
import dbConnect from "./mongodb";
import { User } from "./models";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = "Vallentuna Framåt <no-reply@votes.abbegubbegum.dev>";

async function isOptedOut(email: string): Promise<boolean> {
	try {
		await dbConnect();
		const user = await User.findOne(
			{ email: email.toLowerCase() },
			{ emailOptOut: 1 }
		).lean();
		return (user as { emailOptOut?: boolean } | null)?.emailOptOut === true;
	} catch {
		return false;
	}
}

function getBaseUrl(): string {
	return process.env.NEXTAUTH_URL || "https://votes.abbegubbegum.dev";
}

function unsubscribeFooterHtml(email: string, language = "sv"): string {
	const unsubscribeUrl = `${getBaseUrl()}/api/unsubscribe?email=${encodeURIComponent(email)}`;
	return `
      <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:12px">
        <p style="margin:4px 0">${t(language, "email.unsubscribe.text")}</p>
        <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline">${t(language, "email.unsubscribe.linkText")}</a>
      </div>`;
}

function unsubscribeFooterText(email: string, language = "sv"): string {
	const unsubscribeUrl = `${getBaseUrl()}/api/unsubscribe?email=${encodeURIComponent(email)}`;
	return `\n\n---\n${t(language, "email.unsubscribe.text")}\n${t(language, "email.unsubscribe.linkText")}: ${unsubscribeUrl}`;
}

export async function sendEmail(to: string, subject: string, text: string, html: string, language = "en"): Promise<void> {
	if (await isOptedOut(to)) return;

	text += unsubscribeFooterText(to, language);

	const lastDivIndex = html.lastIndexOf("</div>");
	if (lastDivIndex !== -1) {
		html =
			html.slice(0, lastDivIndex) +
			unsubscribeFooterHtml(to, language) +
			html.slice(lastDivIndex);
	}

	await resend.emails.send({
		to,
		from: FROM_ADDRESS,
		subject,
		text,
		html,
	});
}

export async function sendLoginCode(email: string, code: string, language = "sv"): Promise<void> {
	const subject = t(language, "email.loginCode.subject");
	const text = `${t(language, "email.loginCode.yourCode", { code })}\n\n${t(
		language,
		"email.loginCode.codeValid"
	)}`;
	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5">
      <h2>${t(language, "email.loginCode.title")}</h2>
      <p>${t(language, "email.loginCode.useCodeBelow")}</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</div>
      <p>${t(language, "email.loginCode.ignoreIfNotRequested")}</p>
    </div>
  `;
	await resend.emails.send({
		to: email,
		from: FROM_ADDRESS,
		subject,
		text,
		html,
	});
}

interface TopProposalSummary {
	title: string;
	yesVotes: number;
	noVotes: number;
}

export async function sendSessionResultsEmail(
	email: string,
	sessionPlace: string,
	topProposals: TopProposalSummary[],
	language = "sv"
): Promise<void> {
	const subject = t(language, "email.sessionResults.subject", {
		place: sessionPlace,
	});

	let proposalsList = "";
	if (topProposals.length > 0) {
		proposalsList = topProposals
			.map(
				(p, i) =>
					`${i + 1}. ${p.title} (${p.yesVotes} ${t(
						language,
						"email.sessionResults.yesVotes"
					)}, ${p.noVotes} ${t(
						language,
						"email.sessionResults.noVotes"
					)})`
			)
			.join("\n");
	} else {
		proposalsList = t(language, "email.sessionResults.noMajority");
	}

	const text = `${t(language, "email.sessionResults.thankYou")}

${t(language, "email.sessionResults.session", { place: sessionPlace })}

${
	topProposals.length > 0
		? t(language, "email.sessionResults.proposalsVotedThrough")
		: ""
}
${proposalsList}

${
	topProposals.length > 0
		? t(language, "email.sessionResults.electionPromise")
		: ""
}

${t(language, "email.sessionResults.bestRegards")},
Vallentuna Framåt
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#002d75">${t(
		language,
		"email.sessionResults.thankYou"
	)}</h2>

      <p><strong>${t(language, "email.sessionResults.session", {
		place: sessionPlace,
	})}</strong></p>

      ${
		topProposals.length > 0
			? `
        <h3 style="color:#002d75;margin-top:24px">${t(
			language,
			"email.sessionResults.proposalsVotedThrough"
		)}</h3>
        <ol style="margin:16px 0">
          ${topProposals
				.map(
					(p) =>
						`<li style="margin:8px 0"><strong>${
							p.title
						}</strong><br/>
              <span style="color:#64748b">${p.yesVotes} ${t(
							language,
							"email.sessionResults.yesVotes"
						)}, ${p.noVotes} ${t(
							language,
							"email.sessionResults.noVotes"
						)}</span></li>`
				)
				.join("")}
        </ol>
        <p style="margin-top:24px;padding:16px;background:#fef6e0;border-left:4px solid #f8b60e">
          ${t(language, "email.sessionResults.electionPromise")}
        </p>
      `
			: `<p style="color:#64748b">${t(
					language,
					"email.sessionResults.noMajority"
			  )}</p>`
	}

      <p style="margin-top:32px;color:#64748b">
        ${t(language, "email.sessionResults.bestRegards")},<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html, language);
}

export async function sendBroadcastEmail(
	email: string,
	subject: string,
	message: string,
	language = "sv"
): Promise<void> {
	const text = message;
	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      ${message
		.split("\n")
		.map((line) => `<p>${line}</p>`)
		.join("")}

      <p style="margin-top:32px;color:#64748b">
        ${t(language, "email.broadcast.bestRegards")},<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html, language);
}

export async function sendAdminApplicationNotification(
	email: string,
	applicantName: string,
	applicantEmail: string,
	organization: string,
	requestedSessions: number
): Promise<void> {
	const subject = "New Admin Application";

	const text = `A new user has applied to become an admin.

Name: ${applicantName}
Email: ${applicantEmail}
Organization: ${organization}
Requested Sessions: ${requestedSessions}

Log in to the admin panel to review and approve/deny the application.

Best regards,
Vallentuna Framåt
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#002d75">New Admin Application</h2>
      <p>A new user has applied to become an admin.</p>

      <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:4px 0"><strong>Name:</strong> ${applicantName}</p>
        <p style="margin:4px 0"><strong>Email:</strong> ${applicantEmail}</p>
        <p style="margin:4px 0"><strong>Organization:</strong> ${organization}</p>
        <p style="margin:4px 0"><strong>Requested Sessions:</strong> ${requestedSessions}</p>
      </div>

      <p>Log in to the admin panel to review and approve/deny the application.</p>

      <p style="margin-top:32px;color:#64748b">
        Best regards,<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html);
}

export async function sendAdminApprovalNotification(
	email: string,
	name: string,
	sessionLimit: number
): Promise<void> {
	const subject = "Your Admin Application Has Been Approved";

	const text = `Congratulations ${name}!

Your application to become an admin has been approved.
You can create up to ${sessionLimit} sessions.

Log in to the platform to access the admin panel and start creating sessions.

Best regards,
Vallentuna Framåt
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#16a34a">Your Admin Application Has Been Approved</h2>
      <p>Congratulations ${name}!</p>

      <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #16a34a">
        <p style="margin:4px 0">Your application to become an admin has been approved.</p>
        <p style="margin:4px 0"><strong>You can create up to ${sessionLimit} sessions.</strong></p>
      </div>

      <p>Log in to the platform to access the admin panel and start creating sessions.</p>

      <p style="margin-top:32px;color:#64748b">
        Best regards,<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html);
}

export async function sendAdminDenialNotification(email: string, name: string): Promise<void> {
	const subject = "Your Admin Application Has Been Denied";

	const text = `Hello ${name},

Unfortunately, your application to become an admin has been denied.

Thank you for your interest in becoming an admin. After review, we have decided not to approve your application at this time.

You can apply again in 30 days if you are still interested.

Best regards,
Vallentuna Framåt
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#dc2626">Your Admin Application Has Been Denied</h2>
      <p>Hello ${name},</p>

      <div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #dc2626">
        <p style="margin:4px 0">Unfortunately, your application to become an admin has been denied.</p>
      </div>

      <p>Thank you for your interest in becoming an admin. After review, we have decided not to approve your application at this time.</p>
      <p>You can apply again in 30 days if you are still interested.</p>

      <p style="margin-top:32px;color:#64748b">
        Best regards,<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html);
}

export async function sendSessionRequestNotification(
	email: string,
	adminName: string,
	adminEmail: string,
	organization: string | undefined,
	currentRemaining: number,
	requestedSessions: number
): Promise<void> {
	const subject = "New Session Request";

	const text = `An admin has requested more sessions

Admin: ${adminName}
Email: ${adminEmail}
Organization: ${organization || "N/A"}
Current remaining sessions: ${currentRemaining}
Requested sessions: ${requestedSessions}

Log in to the admin panel to review this request.

Best regards,
Vallentuna Framåt
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#002d75">New Session Request</h2>
      <p>An admin has requested more sessions:</p>

      <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0">
        <p style="margin:4px 0"><strong>Admin:</strong> ${adminName}</p>
        <p style="margin:4px 0"><strong>Email:</strong> ${adminEmail}</p>
        <p style="margin:4px 0"><strong>Organization:</strong> ${organization || "N/A"}</p>
        <p style="margin:4px 0"><strong>Current remaining sessions:</strong> ${currentRemaining}</p>
        <p style="margin:4px 0"><strong>Requested sessions:</strong> ${requestedSessions}</p>
      </div>

      <p>Log in to the admin panel to review this request.</p>

      <p style="margin-top:32px;color:#64748b">
        Best regards,<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html);
}

export async function sendSessionRequestApprovalNotification(
	email: string,
	name: string,
	grantedSessions: number
): Promise<void> {
	const subject = "Your Session Request Has Been Approved";

	const text = `Hello ${name},

Your request for more sessions has been approved!
Granted sessions: ${grantedSessions}

You can now create more sessions from your admin panel.

Best regards,
Vallentuna Framåt
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#16a34a">Request Approved!</h2>
      <p>Hello ${name},</p>

      <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #16a34a">
        <p style="margin:4px 0">Your request for more sessions has been approved!</p>
        <p style="margin:4px 0"><strong>Granted sessions: ${grantedSessions}</strong></p>
      </div>

      <p>You can now create more sessions from your admin panel.</p>

      <p style="margin-top:32px;color:#64748b">
        Best regards,<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html);
}

export async function sendSessionRequestDenialNotification(email: string, name: string): Promise<void> {
	const subject = "Your Session Request Has Been Denied";

	const text = `Hello ${name},

Unfortunately, your request for more sessions has been denied.

If you have questions or would like to discuss this, please contact a superadmin.

Best regards,
Vallentuna Framåt
`;

	const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1e293b">
      <h2 style="color:#dc2626">Request Denied</h2>
      <p>Hello ${name},</p>

      <div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #dc2626">
        <p style="margin:4px 0">Unfortunately, your request for more sessions has been denied.</p>
      </div>

      <p>If you have questions or would like to discuss this, please contact a superadmin.</p>

      <p style="margin-top:32px;color:#64748b">
        Best regards,<br/>
        <strong>Vallentuna Framåt</strong>
      </p>
    </div>
  `;

	await sendEmail(email, subject, text, html);
}
