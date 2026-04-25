(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	const extractLinkedInJobId = rawUrl => {
		if (!rawUrl) return "";
		try {
			const u = new URL(rawUrl, "https://www.linkedin.com");
			const byQuery = u.searchParams.get("currentJobId") || "";
			if (byQuery) return byQuery;
			const byPath = u.pathname.match(/\/jobs\/view\/(\d+)/);
			return byPath ? byPath[1] : "";
		} catch (_) {
			const queryMatch = rawUrl.match(/currentJobId=(\d+)/);
			if (queryMatch) return queryMatch[1];
			const pathMatch = rawUrl.match(/\/jobs\/view\/(\d+)/);
			return pathMatch ? pathMatch[1] : "";
		}
	};

	const parseLinkedInGuestEndpoint = rawHtml => {
		const doc = new DOMParser().parseFromString(rawHtml || "", "text/html");
		const text = selector => (doc.querySelector(selector)?.textContent || "").trim();
		const clean = value => (value || "").replace(/\s+/g, " ").trim();
		return {
			jobTitle:
				clean(text(".top-card-layout__title")) ||
				clean(text(".topcard__title")) ||
				clean(text("h2")),
			company:
				clean(text(".topcard__org-name-link")) ||
				clean(text(".topcard__flavor-row a")) ||
				clean(text("a[href*='/company/']")),
			jobLocation:
				clean(text(".topcard__flavor--bullet")) ||
				clean(text(".topcard__flavor--metadata")) ||
				clean(text(".topcard__flavor-row span")),
		};
	};

	const parseLinkedInFromDom = context => {
		const utils = window.JobMateUtils;
		const { $, pageUrl } = context;
		const result = { jobTitle: "", company: "", jobLocation: "", url: "" };
		const liveUrl = typeof location !== "undefined" ? location.href : "";

		const firstBulletSegment = rawLine => {
			const full = utils.cleanText(rawLine);
			return full.split(/\s*·\s*/u)[0] || full.split(/\s*·\s*/)[0];
		};

		const linkedinLocationFromUnifiedCard = $card => {
			const tertiary = $card
				.find(".job-details-jobs-unified-top-card__tertiary-description-container")
				.first();
			if (!tertiary.length) {
				return utils.cleanText(
					$card.find(".job-details-jobs-unified-top-card__bullet").first().text(),
				);
			}
			let loc = utils.cleanText(tertiary.find(".tvm__text--low-emphasis").first().text());
			if (loc && !/·/.test(loc)) return loc;
			const firstSeg = firstBulletSegment(tertiary.text());
			if (firstSeg) return firstSeg;
			return utils.cleanText(
				$card.find(".job-details-jobs-unified-top-card__bullet").first().text(),
			);
		};

		const linkedinPipeTitleParts = titleStr => {
			const parts = utils
				.cleanText(titleStr)
				.split(/\s*\|\s*/)
				.map(s => s.trim());
			if (parts.length < 3 || !/linkedin/i.test(parts[parts.length - 1])) return null;
			return { jobTitle: parts[0], company: parts[1] };
		};

		const linkedinCompanyFromAria = () => {
			const al = $('[aria-label^="Company,"]').first().attr("aria-label");
			if (!al) return "";
			const m = al.match(/^Company,\s*(.+?)\.\s*$/i);
			return m ? utils.cleanText(m[1]) : "";
		};

		const linkedinCompanyFromLogoAlt = () => {
			const alt = $('img[alt*="Company logo for"]').first().attr("alt");
			if (!alt) return "";
			const m = alt.match(/Company\s+logo\s+for,?\s*(.+?)\./i);
			return m ? utils.cleanText(m[1]) : "";
		};

		const linkedinSduiLocationNearCompany = () => {
			const $companyAriaRoot = $('[aria-label^="Company,"]').first();
			if (!$companyAriaRoot.length) return "";
			let $ancestor = $companyAriaRoot;
			for (let i = 0; i < 20; i++) {
				$ancestor = $ancestor.parent();
				if (!$ancestor.length) break;
				const $candidateLocationParagraph = $ancestor
					.find("p")
					.filter(function () {
						const paragraphText = utils.cleanText($(this).text());
						if (!paragraphText.includes("·")) return false;
						const firstSegment = firstBulletSegment(paragraphText);
						if (/^Promoted|Actively reviewing|Easy Apply/i.test(firstSegment)) return false;
						if (firstSegment.length < 3 || firstSegment.length > 120) return false;
						return (
							/,\s*[A-Za-z]{2}\b|Remote|Hybrid|On-site|United States|Canada|Europe|\bArea\b/i.test(
								firstSegment,
							) || firstSegment.includes(",")
						);
					})
					.first();
				if ($candidateLocationParagraph.length)
					return utils.cleanText(firstBulletSegment($candidateLocationParagraph.text()).trim());
			}
			return "";
		};

		const resolveUnifiedTopCard = targetJobId => {
			const $all = $(".job-details-jobs-unified-top-card__container--two-pane");
			if (!$all.length) return $();

			let bestScore = -1;
			let $best = $();
			$all.each(function () {
				const $candidate = $(this);
				const titleText =
					utils.cleanText(
						$candidate
							.find(".job-details-jobs-unified-top-card__job-title h1 a")
							.first()
							.text(),
					) ||
					utils.cleanText(
						$candidate.find(".job-details-jobs-unified-top-card__job-title h1").first().text(),
					);
				const companyText =
					utils.cleanText(
						$candidate
							.find(".job-details-jobs-unified-top-card__company-name a")
							.first()
							.text(),
					) ||
					utils.cleanText(
						$candidate.find(".job-details-jobs-unified-top-card__company-name").first().text(),
					);
				const primaryHref = utils.cleanText(
					$candidate
						.find('.job-details-jobs-unified-top-card__job-title a[href*="/jobs/view/"]')
						.first()
						.attr("href"),
				);

				let score = 0;
				if (titleText) score += 4;
				if (companyText) score += 3;
				if ($candidate.is(":visible")) score += 1;
				if (targetJobId && primaryHref.includes(`/jobs/view/${targetJobId}`)) score += 8;
				if (primaryHref.includes("/jobs/view/")) score += 2;

				if (score > bestScore) {
					bestScore = score;
					$best = $candidate;
				}
			});

			return $best.length ? $best : $all.last();
		};

		// Several two-pane roots can exist (inactive scaffolds). jQuery .find() on
		// a multi-match set merges descendants and .text() can concatenate wrong
		// nodes—always read from one resolved element.
		const jobId = extractLinkedInJobId(liveUrl) || extractLinkedInJobId(pageUrl);
		const $card = resolveUnifiedTopCard(jobId);
		if ($card.length) {
			result.jobTitle =
				utils.cleanText(
					$card.find(".job-details-jobs-unified-top-card__job-title h1 a").first().text(),
				) ||
				utils.cleanText(
					$card.find(".job-details-jobs-unified-top-card__job-title h1").first().text(),
				);
			result.company =
				utils.cleanText(
					$card.find(".job-details-jobs-unified-top-card__company-name a").first().text(),
				) ||
				utils.cleanText($card.find(".job-details-jobs-unified-top-card__company-name").first().text());
			result.jobLocation = linkedinLocationFromUnifiedCard($card);
		}

		const titleCompanyFromDocumentTitle = linkedinPipeTitleParts(document.title);
		if (titleCompanyFromDocumentTitle) {
			if (!result.jobTitle) result.jobTitle = titleCompanyFromDocumentTitle.jobTitle;
			if (!result.company) result.company = titleCompanyFromDocumentTitle.company;
		}

		const openGraphTitle = utils.cleanText($('meta[property="og:title"]').attr("content"));
		if (openGraphTitle) {
			const titleCompanyFromOg = linkedinPipeTitleParts(openGraphTitle);
			if (titleCompanyFromOg) {
				if (!result.jobTitle) result.jobTitle = titleCompanyFromOg.jobTitle;
				if (!result.company) result.company = titleCompanyFromOg.company;
			}
		}

		if (!result.company) result.company = linkedinCompanyFromAria() || linkedinCompanyFromLogoAlt();
		if (!result.jobLocation) result.jobLocation = linkedinSduiLocationNearCompany();

		if (!result.jobTitle) result.jobTitle = utils.cleanText($("h1.jobs-top-card__job-title").text());
		if (!result.company)
			result.company = utils.cleanText($("a.jobs-top-card__company-url").text().replace(/\n/g, ""));
		if (!result.jobLocation)
			result.jobLocation = utils.cleanText(
				$("span.jobs-top-card__bullet").first().text().replace(/\n/g, " "),
			);

		result.url = liveUrl || pageUrl || "";
		return result;
	};

	api.register({
		domain: "linkedin.com",
		parseHost: context => {
			const domResult = parseLinkedInFromDom(context);
			const hasCoreFields = parsed =>
				Boolean(parsed?.jobTitle) || Boolean(parsed?.company) || Boolean(parsed?.jobLocation);
			if (hasCoreFields(domResult)) return domResult;

			const sourceUrl = domResult.url || context.pageUrl || "";
			const jobId = extractLinkedInJobId(sourceUrl);
			if (!jobId) return domResult;

			return fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`)
				.then(async response => {
					const html = await response.text();
					const fallback = parseLinkedInGuestEndpoint(html);
					return {
						jobTitle: domResult.jobTitle || fallback.jobTitle || "",
						company: domResult.company || fallback.company || "",
						jobLocation: domResult.jobLocation || fallback.jobLocation || "",
						url: domResult.url || sourceUrl || "",
					};
				})
				.catch(() => domResult);
		},
	});
})();
