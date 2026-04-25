(function () {
	const api = window.JobMateParsers;
	const safeAbsUrl = window.JobMateUtils && window.JobMateUtils.safeAbsUrl;
	if (!api || !safeAbsUrl) return;

	const normalizeIcimsJobUrl = (cleanText, href, base) => {
		const absoluteUrl = safeAbsUrl(cleanText, href, base);
		if (!absoluteUrl) return "";
		try {
			const parsed = new URL(absoluteUrl);
			if (!/\/jobs\//i.test(parsed.pathname)) return "";
			if (/(login|referral|\/apply)/i.test(parsed.pathname)) return "";
			parsed.search = "";
			parsed.hash = "";
			return cleanText(parsed.href);
		} catch (_e) {
			return "";
		}
	};

	const locationFromDashTitle = (utils, rawTitle) => {
		const normalized = utils.cleanText(rawTitle);
		if (!normalized) return "";
		const head = utils.cleanText(normalized.split(/\s*\|\s*/)[0]);
		const parts = head.split(/\s*-\s*/).map(utils.cleanText).filter(Boolean);
		if (parts.length < 2) return "";
		const tail = parts[parts.length - 1];
		if (tail.length < 2 || tail.length > 60) return "";
		if (/^\d/.test(tail)) return "";
		if (/^(careers?|jobs?|job details?)$/i.test(tail)) return "";
		if (
			/\bRemote|Hybrid|On-site|United States|Canada|Europe|Area\b/i.test(tail) ||
			/,\s*[A-Za-z]{2}\b/.test(tail) ||
			/^[A-Za-z.'\-\s]+$/.test(tail)
		)
			return tail;
		return "";
	};

	const locationFromIcimsJobUrlSlug = (utils, rawUrl) => {
		if (!rawUrl) return "";
		try {
			const u = new URL(rawUrl);
			const host = u.hostname.replace(/^www\./, "").toLowerCase();
			if (!host.endsWith("icims.com")) return "";
			const segs = u.pathname.split("/").filter(Boolean);
			const jobIdx = segs.findIndex(x => /^jobs?$/i.test(x));
			if (jobIdx < 0 || segs.length <= jobIdx + 2) return "";
			const slug = utils.cleanText(segs[jobIdx + 2] || "");
			if (!slug) return "";

			const parts = slug.split(/-{3,}/).map(utils.cleanText).filter(Boolean);
			const candidateSlug = parts.length >= 2 ? parts[parts.length - 1] : slug;
			const candidate = utils.titleCaseWords(candidateSlug.replace(/[-_]+/g, " "));
			if (!candidate) return "";
			if (candidate.length < 2 || candidate.length > 60) return "";
			if (/^(login|apply|details?)$/i.test(candidate)) return "";
			return candidate;
		} catch (_e) {
			return "";
		}
	};

	const looksLikeJunkTitle = (utils, raw) => {
		const t = utils.cleanText(raw);
		if (!t) return true;
		if (t.length < 3 || t.length > 200) return true;
		if (/^transcript$/i.test(t)) return true;
		if (/^(saved by blink|job|jobs|careers|job details?|details?)$/i.test(t)) return true;
		if (/^(apply now|share job)$/i.test(t)) return true;
		return false;
	};

	const embeddedTitleFromCareerUrlSlug = (utils, rawUrl) => {
		if (!rawUrl) return "";
		try {
			const u = new URL(rawUrl);
			const segs = u.pathname.split("/").filter(Boolean);
			const idx = segs.findIndex(s => /^job\.html$/i.test(s));
			if (idx < 0 || segs.length <= idx + 3) return "";
			const slug = utils.cleanText(segs[idx + 3] || "");
			if (!slug) return "";
			const title = utils.titleCaseWords(slug.replace(/[-_]+/g, " "));
			return looksLikeJunkTitle(utils, title) ? "" : title;
		} catch (_e) {
			return "";
		}
	};

	api.register({
		domain: "icims.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const icimsHeaderMap = () => {
				const map = {};
				$(".iCIMS_JobHeaderTag").each(function () {
					const $tag = $(this);
					const label = utils.cleanText(
						$tag.find("dt .field-label").first().text() ||
							$tag.find("dt.iCIMS_JobHeaderField").first().text() ||
							$tag.find("dt").first().text(),
					);
					const val = utils.cleanText($tag.find("dd").first().text());
					if (label && val) map[label.toLowerCase()] = val;
				});
				return map;
			};

			const icimsOgTitle = () =>
				utils.firstNonEmpty(
					$('meta[property="og:title"]').attr("content"),
					$('meta[name="twitter:title"]').attr("content"),
					$('meta[property="title"]').attr("content"),
				);

			const icimsMetaDescription = () =>
				utils.firstNonEmpty(
					$('meta[property="og:description"]').attr("content"),
					$('meta[name="description"]').attr("content"),
				);

			const icimsLocationFromInlineFieldLabels = () => {
				let locationFromLabelWalk = "";
				$(
					".iCIMS_JobsTable span.field-label, .iCIMS_JobContent span.field-label, .iCIMS_JobContainer span.field-label",
				).each(function () {
					const lab = utils.cleanText($(this).text());
					if (!/^(job\s+)?location$/i.test(lab)) return;
					const $next = $(this).next("span");
					if ($next.length) {
						locationFromLabelWalk = utils.cleanText($next.text());
						return false;
					}
					locationFromLabelWalk = utils.cleanText(
						$(this).parent().find("span").not(this).first().text(),
					);
					if (locationFromLabelWalk) return false;
				});
				return locationFromLabelWalk;
			};

			result.jobTitle = utils.cleanText($("h1.iCIMS_Header").first().text());
			if (!result.jobTitle) {
				const og = icimsOgTitle();
				const m = og.match(/^(.+?)\s+in\s+.+\s*(?:\||[–—-])\s*/i) || og.match(/^(.+?)\s+in\s+.+$/i);
				if (m) result.jobTitle = utils.cleanText(m[1]);
			}
			if (!result.jobTitle) {
				const t = utils.cleanText(document.title);
				const m2 = t.match(/^(.+?)\s+in\s+.+\s*(?:\||[–—-])\s*/i) || t.match(/^(.+?)\s+in\s+.+$/i);
				if (m2) result.jobTitle = utils.cleanText(m2[1]);
			}

			const headerFieldsByLabel = icimsHeaderMap();
			result.company = headerFieldsByLabel["brand"] || "";
			if (!result.company) {
				const site = utils.cleanText($('meta[property="og:site_name"]').attr("content"));
				if (site && !/\s+in\s+.+,/i.test(site)) result.company = site;
			}
			if (!result.company) {
				try {
					let sub = new URL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`).hostname.replace(
						/\.icims\.com$/i,
						"",
					);
					sub = sub.replace(/^careers?-/i, "");
					const slug = utils.cleanText(sub.replace(/-/g, " "));
					if (slug) result.company = utils.titleCaseWords(slug);
				} catch (_e) {}
			}

			const city = headerFieldsByLabel["city"] || "";
			const addl = headerFieldsByLabel["additional locations"] || "";
			const state = headerFieldsByLabel["state"] || headerFieldsByLabel["province"] || "";
			const loc =
				headerFieldsByLabel["location"] ||
				headerFieldsByLabel["locations"] ||
				headerFieldsByLabel["job location"] ||
				headerFieldsByLabel["primary location"] ||
				headerFieldsByLabel["work location"] ||
				headerFieldsByLabel["office location"] ||
				headerFieldsByLabel["site"] ||
				headerFieldsByLabel["address"] ||
				headerFieldsByLabel["country"] ||
				headerFieldsByLabel["region"] ||
				"";
			if (city && addl) result.jobLocation = utils.cleanText(`${city}; ${addl}`);
			else if (city && state) result.jobLocation = utils.cleanText(`${city}, ${state}`);
			else result.jobLocation = utils.cleanText(city || addl || state || loc);

			if (!result.jobLocation) result.jobLocation = icimsLocationFromInlineFieldLabels();
			if (!result.jobLocation) {
				const og = icimsOgTitle();
				let m = og.match(/\s+in\s+(.+?)\s*(?:\||[–—-])\s*/i);
				if (!m) m = og.match(/\s+in\s+(.+)$/i);
				if (m) result.jobLocation = utils.cleanText(m[1]);
			}
			if (!result.jobLocation) {
				const t = utils.cleanText(document.title);
				let m = t.match(/\s+in\s+(.+?)\s*(?:\||[–—-])\s*/i);
				if (!m) m = t.match(/\s+in\s+(.+)$/i);
				if (m) result.jobLocation = utils.cleanText(m[1]);
			}
			if (!result.jobLocation) {
				const desc = icimsMetaDescription();
				let m = desc.match(/(?:hiring|seeking)(?:\s+a|\s+an)?\s+[^.]+?\s+in\s+([^.]+)\./i);
				if (!m) m = desc.match(/\s+in\s+([^.]+)\.\s*(?:Review|Apply|Click)/i);
				if (m) result.jobLocation = utils.cleanText(m[1]);
			}

			const icimsBase = pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`;
			result.url = utils.firstNonEmpty(
				normalizeIcimsJobUrl(utils.cleanText, utils.urlFromCanonicalOrOg($, utils.cleanText), icimsBase),
				normalizeIcimsJobUrl(utils.cleanText, pageUrl, icimsBase),
			);

			return result;
		},

		parseEmbedded: (context, evidenceUrl) => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };
			const valueFromLabeledBlock = labelPattern => {
				let found = "";
				$("h6, dt, strong, b, span").each(function () {
					if (found) return false;
					const label = utils.cleanText($(this).text());
					if (!labelPattern.test(label)) return;

					const fromSibling = utils.cleanText(
						$(this).nextAll("p, span, div, dd").first().text(),
					);
					if (fromSibling) {
						found = fromSibling;
						return false;
					}

					const fromParent = utils.cleanText(
						$(this).parent().find("p, span, div, dd").not(this).first().text(),
					);
					if (fromParent) {
						found = fromParent;
						return false;
					}
				});
				return found;
			};
			const locationFromLabeledBlock = () => valueFromLabeledBlock(/^(job\s+)?location$/i);
			const companyFromBrandLabel = () => valueFromLabeledBlock(/^brand$/i);
			const hostPageTitle = () =>
				utils.firstNonEmpty(
					// Enterprise Mobility career pages render the role here.
					$(".cmp-teaser__title").first().text(),
					$(".cmp-job-detail-info-banner h2").first().text(),
					$("main h1, main h2, [role='main'] h1, [role='main'] h2").first().text(),
				);
			const firstNonJunk = (...vals) => {
				for (const v of vals) {
					const t = utils.cleanText(v);
					if (!looksLikeJunkTitle(utils, t)) return t;
				}
				return "";
			};

			const og = utils.firstNonEmpty($('meta[property="og:title"]').attr("content"), document.title);
			const parsed = utils.parseTitleLocationFromTitle(og);
			const titleParts = og.split(/\s*\|\s*/).map(utils.cleanText).filter(Boolean);

			result.jobTitle = firstNonJunk(
				$("h1.iCIMS_Header, h1").first().text(),
				hostPageTitle(),
				parsed.title,
				embeddedTitleFromCareerUrlSlug(utils, pageUrl),
			);
			result.jobLocation = utils.firstNonEmpty(
				$(".iCIMS_JobsTable span.field-label")
					.filter(function () {
						return /^(job\s+)?location$/i.test(utils.cleanText($(this).text()));
					})
					.first()
					.next("span")
					.text(),
				locationFromLabeledBlock(),
				parsed.location,
				locationFromDashTitle(utils, og),
				locationFromIcimsJobUrlSlug(utils, evidenceUrl),
				locationFromIcimsJobUrlSlug(utils, pageUrl),
			);
			result.company = utils.firstNonEmpty(
				$(".iCIMS_JobHeaderTag dt:contains('Brand')").first().next("dd").text(),
				companyFromBrandLabel(),
				titleParts.length >= 2 ? utils.titleCaseWords(titleParts[titleParts.length - 1]) : "",
			);
			if (!result.company && evidenceUrl) {
				try {
					let sub = new URL(evidenceUrl).hostname.replace(/\.icims\.com$/i, "");
					sub = sub.replace(/^careers?-?/i, "");
					if (sub) result.company = utils.titleCaseWords(sub.replace(/[-_]+/g, " "));
				} catch (_e) {}
			}
			result.url = normalizeIcimsJobUrl(utils.cleanText, evidenceUrl, pageUrl);

			return result;
		},
	});
})();
