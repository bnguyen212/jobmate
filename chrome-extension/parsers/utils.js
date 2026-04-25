(function () {
	/** Resolve relative/protocol-relative href against base; return cleaned absolute URL or "". */
	const safeAbsUrl = (cleanText, href, base) => {
		if (!href) return "";
		try {
			return cleanText(new URL(href, base).href);
		} catch (_e) {
			return "";
		}
	};

	const cleanText = raw =>
		String(raw || "")
			.replace(/\s+/g, " ")
			.replace(/\u00a0/g, " ")
			.trim();

	const titleCaseWords = text =>
		cleanText(text)
			.split(/\s+/)
			.filter(Boolean)
			.map(word => {
				if (/^\d+$/.test(word)) return word;
				return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
			})
			.join(" ");

	const firstNonEmpty = (...vals) => vals.map(cleanText).find(Boolean) || "";

	const parseTitleLocationFromTitle = raw => {
		const normalized = cleanText(raw);
		if (!normalized) return { title: "", location: "" };
		const matchWithTrailingSource = normalized.match(/^(.+?)\s+in\s+(.+?)\s*(?:\||[–—-])\s*(.+)$/i);
		if (matchWithTrailingSource)
			return {
				title: cleanText(matchWithTrailingSource[1]),
				location: cleanText(matchWithTrailingSource[2]),
			};
		const matchTitleInLocation = normalized.match(/^(.+?)\s+in\s+(.+)$/i);
		if (matchTitleInLocation) {
			const titlePart = cleanText(matchTitleInLocation[1]);
			const locationPart = cleanText(matchTitleInLocation[2]);
			// e.g. "…Jobs and Careers in Middletown at AT&T" — the first " in " is marketing, not "role in city".
			if (/\bcareers\b/i.test(titlePart) && /\s+at\s+/i.test(locationPart)) {
				return { title: cleanText(normalized.split(/\s*\|\s*/)[0]), location: "" };
			}
			return { title: titlePart, location: locationPart };
		}
		const titleBeforePipe = normalized.split(/\s*\|\s*/)[0];
		return { title: cleanText(titleBeforePipe), location: "" };
	};

	/** Prefer canonical link, then og:url (stable job URL). Returns '' if neither. */
	const urlFromCanonicalOrOg = ($, normalize) => {
		const canonicalHref = $('link[rel="canonical"]').attr("href");
		if (canonicalHref) return normalize(canonicalHref);
		const openGraphUrl = $('meta[property="og:url"]').attr("content");
		return openGraphUrl ? normalize(openGraphUrl) : "";
	};

	const collectEmbeddedEvidenceUrls = ($, pageUrl, normalize) => {
		const base = pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`;
		const uniqueUrls = new Set();
		const collectIfAbsolute = candidateHref => {
			const absolute = safeAbsUrl(normalize, candidateHref, base);
			if (absolute) uniqueUrls.add(absolute);
		};

		collectIfAbsolute(pageUrl);
		collectIfAbsolute(urlFromCanonicalOrOg($, normalize));
		collectIfAbsolute($('meta[name="search-job-apply-url"]').attr("content"));
		collectIfAbsolute($('meta[name="search-job-url"]').attr("content"));
		collectIfAbsolute($('meta[name="search-job-detail-url"]').attr("content"));
		collectIfAbsolute($('meta[name="search-job-details-url"]').attr("content"));
		collectIfAbsolute($('meta[name="search-job-external-url"]').attr("content"));
		collectIfAbsolute($('meta[name="search-job-external-apply-url"]').attr("content"));

		$(
			"a[href], iframe[src], [data-apply-url], [data-job-url], [data-delay-url], [data-url], [data-href]",
		).each(function () {
			const $el = $(this);
			collectIfAbsolute($el.attr("href"));
			collectIfAbsolute($el.attr("src"));
			collectIfAbsolute($el.attr("data-apply-url"));
			collectIfAbsolute($el.attr("data-job-url"));
			collectIfAbsolute($el.attr("data-delay-url"));
			collectIfAbsolute($el.attr("data-url"));
			collectIfAbsolute($el.attr("data-href"));
		});

		$("script[src], link[rel='preconnect'][href], link[rel='dns-prefetch'][href]").each(function () {
			const $el = $(this);
			collectIfAbsolute($el.attr("src"));
			collectIfAbsolute($el.attr("href"));
		});

		return Array.from(uniqueUrls);
	};

	/** Match ATS job URLs when picking evidence for embedded parsers; also used to score URL signals in detectEmbeddedPlatform. */
	const embeddedEvidenceUrlPatternByPlatform = {
		"myworkdayjobs.com": /myworkdayjobs\.com/i,
		"icims.com": /\.icims\.com/i,
		"greenhouse.io": /(?:boards|job-boards)\.greenhouse\.io\//i,
	};

	const detectEmbeddedPlatform = ($, pageUrl, normalize) => {
		const evidenceUrls = collectEmbeddedEvidenceUrls($, pageUrl, normalize);
		const score = {
			"myworkdayjobs.com": 0,
			"icims.com": 0,
			"greenhouse.io": 0,
		};

		let hasGhJobId = false;
		try {
			const u = new URL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`);
			hasGhJobId = Boolean(u.searchParams.get("gh_jid") || u.searchParams.get("gh_src"));
		} catch (_e) {}
		if (hasGhJobId) score["greenhouse.io"] += 12;

		evidenceUrls.forEach(evidenceUrl => {
			Object.keys(embeddedEvidenceUrlPatternByPlatform).forEach(platformKey => {
				if (embeddedEvidenceUrlPatternByPlatform[platformKey].test(evidenceUrl))
					score[platformKey] += 3;
			});
		});

		if ($('[data-automation-id="jobDetails"], [data-automation-id="jobPostingHeader"]').length)
			score["myworkdayjobs.com"] += 5;
		if ($(".iCIMS_JobContainer, .iCIMS_JobPage, .iCIMS_JobHeaderTag").length) score["icims.com"] += 5;
		if (
			$(
				'iframe[src*="greenhouse.io"], a[href*="boards.greenhouse.io"], a[href*="job-boards.greenhouse.io"], script[src*="greenhouse.io"]',
			).length
		)
			score["greenhouse.io"] += 4;
		if (
			$("#grnhse_app, #grnhse_iframe, [id*='greenhouse'], [class*='greenhouse'], [data-greenhouse]").length
		)
			score["greenhouse.io"] += 3;

		let platform = "";
		let maxScore = 0;
		Object.keys(score).forEach(platformKey => {
			if (score[platformKey] > maxScore) {
				maxScore = score[platformKey];
				platform = platformKey;
			}
		});
		return { platform: maxScore > 0 ? platform : "", evidenceUrls };
	};

	const firstMatchingEvidenceUrl = (urls, urlPattern) =>
		urls.find(candidate => urlPattern.test(candidate)) || "";

	window.JobMateUtils = {
		cleanText,
		titleCaseWords,
		firstNonEmpty,
		parseTitleLocationFromTitle,
		urlFromCanonicalOrOg,
		safeAbsUrl,
		collectEmbeddedEvidenceUrls,
		detectEmbeddedPlatform,
		embeddedEvidenceUrlPatternByPlatform,
		firstMatchingEvidenceUrl,
	};
})();
