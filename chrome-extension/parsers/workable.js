(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	/** Extract a JSON object starting at `{`, respecting strings (for embedded `window.jobBoard` state). */
	const extractBalancedJsonObject = (html, startIdx) => {
		if (html[startIdx] !== "{") return "";
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let i = startIdx; i < html.length; i++) {
			const ch = html[i];
			if (escaped) {
				escaped = false;
				continue;
			}
			if (inString) {
				if (ch === "\\") {
					escaped = true;
					continue;
				}
				if (ch === '"') inString = false;
				continue;
			}
			if (ch === '"') {
				inString = true;
				continue;
			}
			if (ch === "{") depth++;
			else if (ch === "}") {
				depth--;
				if (depth === 0) return html.slice(startIdx, i + 1);
			}
		}
		return "";
	};

	const mapWorkableEmbeddedJob = (data, utils) => {
		if (!data || typeof data !== "object") return null;
		const companyObj = data.company && typeof data.company === "object" ? data.company : null;
		let loc = "";
		if (Array.isArray(data.locations) && data.locations.length) {
			loc = data.locations
				.map(x => {
					const t = utils.cleanText(String(x));
					if (/^telecommute$/i.test(t)) return "Remote";
					return t;
				})
				.filter(Boolean)
				.join("; ");
		} else if (data.location && typeof data.location === "object") {
			const locObj = data.location;
			const bits = [locObj.city, locObj.subregion, locObj.countryName].map(x => utils.cleanText(x)).filter(Boolean);
			if (bits.length) loc = bits.join(", ");
		}
		return {
			jobTitle: utils.cleanText(data.title),
			company: companyObj ? utils.cleanText(companyObj.title) : "",
			jobLocation: loc,
			url: utils.cleanText(data.url) || "",
		};
	};

	/**
	 * Jobs by Workable (`jobs.workable.com`) embeds postings in `window.jobBoard.initialState`:
	 * - Job page: `api/v1/jobs/<jobId>.data`
	 * - Search (e.g. `?selectedJobId=`): `api/v1/jobs.data.jobs[]` (not the same key as job pages)
	 */
	const parseJobsWorkableComBoard = (utils, pageUrl) => {
		let host = "";
		let jobId = "";
		try {
			const u = new URL(pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`);
			host = u.hostname.replace(/^www\./, "");
			const fromPath = u.pathname.match(/^\/view\/([^/]+)\//);
			jobId = (fromPath && fromPath[1]) || utils.cleanText(u.searchParams.get("selectedJobId") || "");
		} catch (_e) {
			return null;
		}
		if (host !== "jobs.workable.com" || !jobId) return null;

		const html = document.documentElement ? document.documentElement.outerHTML : "";

		const tryDetail = () => {
			const prefix = `"api/v1/jobs/${jobId}":{"status":200,"data":`;
			const p = html.indexOf(prefix);
			if (p === -1) return null;
			const dataJson = extractBalancedJsonObject(html, p + prefix.length);
			if (!dataJson) return null;
			try {
				return mapWorkableEmbeddedJob(JSON.parse(dataJson), utils);
			} catch (_e) {
				return null;
			}
		};

		const trySearchList = () => {
			const prefix = `"api/v1/jobs":{"status":200,"data":`;
			const p = html.indexOf(prefix);
			if (p === -1) return null;
			const dataJson = extractBalancedJsonObject(html, p + prefix.length);
			if (!dataJson) return null;
			try {
				const listData = JSON.parse(dataJson);
				const jobs = listData.jobs;
				if (!Array.isArray(jobs)) return null;
				const row = jobs.find(j => j && j.id === jobId);
				return row ? mapWorkableEmbeddedJob(row, utils) : null;
			} catch (_e) {
				return null;
			}
		};

		// Search SSR only includes the first page of `jobs[]`; `selectedJobId` may point to a row not in that
		// chunk (and `window.jobBoard` is not visible from isolated content scripts). Same-origin GET works.
		const tryApiByJobId = () => {
			try {
				const xhr = new XMLHttpRequest();
				xhr.open(
					"GET",
					`https://jobs.workable.com/api/v1/jobs/${encodeURIComponent(jobId)}`,
					false,
				);
				xhr.send(null);
				if (xhr.status !== 200) return null;
				const data = JSON.parse(xhr.responseText);
				return mapWorkableEmbeddedJob(data, utils);
			} catch (_e) {
				return null;
			}
		};

		return tryDetail() || trySearchList() || tryApiByJobId();
	};

	api.register({
		domain: "workable.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const board = parseJobsWorkableComBoard(utils, pageUrl);
			if (board) {
				result.jobTitle = board.jobTitle;
				result.company = board.company;
				result.jobLocation = board.jobLocation;
			}

			result.jobTitle =
				utils.firstNonEmpty(
					result.jobTitle,
					utils.cleanText($('[data-ui="job-title"]').first().text()),
					utils.cleanText($(".job-title h1").text()),
					utils.cleanText($(".section--header h1").text()),
				) || result.jobTitle;

			result.company =
				utils.firstNonEmpty(
					result.company,
					utils.cleanText($('[data-ui="company-name"]').first().text()),
					utils.cleanText($('[data-ui="company-logo"] img[alt]').first().attr("alt")),
					utils.cleanText($('[data-ui="company-logo"] img').first().attr("alt")),
				) || result.company;

			if (!result.company) {
				const titleFromMetaOrPage =
					utils.cleanText($('meta[property="og:title"]').attr("content")) ||
					utils.cleanText(document.title);
				// jobs.workable.com: "Role | Company | Jobs By Workable"
				const pipeParts = titleFromMetaOrPage.split(/\s*\|\s*/).map(s => utils.cleanText(s)).filter(Boolean);
				if (pipeParts.length >= 2 && /workable/i.test(pipeParts[pipeParts.length - 1])) {
					if (!result.jobTitle) result.jobTitle = pipeParts[0];
					if (pipeParts.length >= 2 && !/jobs by workable/i.test(pipeParts[1]))
						result.company = utils.firstNonEmpty(result.company, pipeParts[1]);
				}
				const dashSeparatorIndex = titleFromMetaOrPage.lastIndexOf(" - ");
				if (dashSeparatorIndex !== -1) {
					const leftSegment = utils.cleanText(titleFromMetaOrPage.slice(0, dashSeparatorIndex));
					const rightSegment = utils.cleanText(titleFromMetaOrPage.slice(dashSeparatorIndex + 3));
					if (!result.jobTitle) {
						result.jobTitle = leftSegment;
						result.company = utils.firstNonEmpty(result.company, rightSegment);
					} else if (leftSegment === utils.cleanText(result.jobTitle)) {
						result.company = utils.firstNonEmpty(result.company, rightSegment);
					}
				}
			}
			if (!result.company) {
				const parts = document.title
					.split(/\s*[-–|]\s*/)
					.map(s => utils.cleanText(s))
					.filter(Boolean);
				if (parts.length >= 2) result.company = utils.firstNonEmpty(result.company, parts[parts.length - 1]);
			}

			result.jobLocation =
				utils.firstNonEmpty(
					result.jobLocation,
					utils.cleanText($('[data-ui="job-location"]').first().text()),
					utils.cleanText($('[data-ui="job-location-tooltip"]').text()),
					utils.cleanText($(".section--header h1").next().text()),
				) || result.jobLocation;

			result.url =
				utils.firstNonEmpty(
					board && board.url ? board.url : "",
					utils.urlFromCanonicalOrOg($, utils.cleanText),
					pageUrl.startsWith("http") ? utils.cleanText(pageUrl) : "",
				) || result.url;
			return result;
		},
	});
})();
