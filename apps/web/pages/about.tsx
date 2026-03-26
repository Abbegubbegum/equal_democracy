import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "../lib/hooks/useTranslation";
import { useConfig } from "../lib/contexts/ConfigContext";
export default function AboutPage() {
	const { data: session } = useSession();
	const router = useRouter();
	const { t } = useTranslation();
	useConfig();

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
			{/* Header */}
			<header className="bg-blue-600 text-white p-6 shadow-lg">
				<div className="max-w-4xl mx-auto">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold">{t("about.title")}</h1>
							<p className="text-blue-100 mt-2">{t("about.subtitle")}</p>
						</div>
						<Link
							href="/"
							className="px-4 py-2 bg-yellow-400 text-gray-900 hover:bg-yellow-500 rounded-lg font-medium"
						>
							{t("common.backToStart")}
						</Link>
					</div>
				</div>
			</header>

			{/* Content */}
			<div className="max-w-4xl mx-auto p-6">
				<div className="bg-white rounded-2xl shadow-md p-8 space-y-6">
					{/* Introduction */}
					<section>
						<h2 className="text-2xl font-bold text-blue-800 mb-4">
							{t("about.whatIs")}
						</h2>
						<p className="text-gray-700 leading-relaxed">
							{t("about.introduction")}
						</p>
					</section>

					{/* How it works */}
					<section>
						<h2 className="text-2xl font-bold text-blue-800 mb-4">
							{t("about.howItWorks")}
						</h2>
						<div className="space-y-4">
							<div className="flex gap-4">
								<div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 font-bold">
									1
								</div>
								<div>
									<h3 className="font-bold text-gray-800 mb-1">
										{t("about.phase1Title")}
									</h3>
									<p className="text-gray-700">
										{t("about.phase1Description")}
									</p>
								</div>
							</div>
							<div className="flex gap-4">
								<div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 font-bold">
									2
								</div>
								<div>
									<h3 className="font-bold text-gray-800 mb-1">
										{t("about.phase2Title")}
									</h3>
									<p className="text-gray-700">
										{t("about.phase2Description")}
									</p>
								</div>
							</div>
							<div className="flex gap-4">
								<div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shrink-0 font-bold">
									3
								</div>
								<div>
									<h3 className="font-bold text-gray-800 mb-1">
										{t("about.phase3Title")}
									</h3>
									<p className="text-gray-700">
										{t("about.phase3Description")}
									</p>
								</div>
							</div>
						</div>
					</section>

					{/* Key features */}
					<section>
						<h2 className="text-2xl font-bold text-blue-800 mb-4">
							{t("about.keyFeatures")}
						</h2>
						<ul className="space-y-3">
							<li className="flex gap-3">
								<span className="text-blue-600 text-xl">✓</span>
								<span className="text-gray-700">
									{t("about.feature1")}
								</span>
							</li>
							<li className="flex gap-3">
								<span className="text-blue-600 text-xl">✓</span>
								<span className="text-gray-700">
									{t("about.feature2")}
								</span>
							</li>
							<li className="flex gap-3">
								<span className="text-blue-600 text-xl">✓</span>
								<span className="text-gray-700">
									{t("about.feature3")}
								</span>
							</li>
							<li className="flex gap-3">
								<span className="text-blue-600 text-xl">✓</span>
								<span className="text-gray-700">
									{t("about.feature4")}
								</span>
							</li>
							<li className="flex gap-3">
								<span className="text-blue-600 text-xl">✓</span>
								<span className="text-gray-700">
									{t("about.feature5")}
								</span>
							</li>
						</ul>
					</section>

					{/* Call to action */}
					<section className="bg-blue-50 rounded-xl p-6 mt-8">
						<h2 className="text-2xl font-bold text-blue-800 mb-4">
							{t("about.getInvolved")}
						</h2>
						<p className="text-gray-700 mb-4">
							{t("about.getInvolvedDescription")}
						</p>
						{!session && (
							<button
								onClick={() => router.push("/login")}
								className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
							>
								{t("about.joinNow")}
							</button>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
