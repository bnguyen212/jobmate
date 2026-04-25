(function () {
	const api = window.JobMateParsers;
	const safeAbsUrl = window.JobMateUtils && window.JobMateUtils.safeAbsUrl;
	if (!api || !safeAbsUrl) return;

	const isWorkdayJobPostingUrl = (cleanText, href, base) => {
		const absoluteUrl = safeAbsUrl(cleanText, href, base);
		if (!absoluteUrl) return false;
		try {
			const parsed = new URL(absoluteUrl);
			if (/\/apply\/?$/i.test(parsed.pathname)) return false;
			return /\/(job|details)\//i.test(parsed.pathname);
		} catch (_e) {
			return false;
		}
	};

	const normalizeWorkdayJobUrl = (cleanText, href, base) => {
		const absoluteUrl = safeAbsUrl(cleanText, href, base);
		if (!absoluteUrl) return "";
		try {
			const parsed = new URL(absoluteUrl);
			if (/\/apply\/?$/i.test(parsed.pathname)) {
				parsed.pathname = parsed.pathname.replace(/\/apply\/?$/i, "");
			}
			if (!/\/(job|details)\//i.test(parsed.pathname)) return "";
			parsed.hash = "";
			return cleanText(parsed.href);
		} catch (_e) {
			return "";
		}
	};

	api.register({
		domain: "myworkdayjobs.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;

			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };
			const wdPageBase = pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`;
			const $jd = $('[data-automation-id="jobDetails"]');

			result.jobTitle = utils.firstNonEmpty(
				($jd.length ? $jd : $(document)).find('[data-automation-id="jobPostingHeader"]').first().text(),
				$('[data-automation-id="jobPostingHeader"]').first().text(),
				utils.parseTitleLocationFromTitle($('meta[property="og:title"]').attr("content")).title,
				utils.parseTitleLocationFromTitle(document.title).title,
			);

			if ($jd.length) {
				result.jobLocation = utils.firstNonEmpty(
					$jd.find('[data-automation-id="locations"]').first().find("dd").first().text(),
				);
			} else {
				const $hdr = $('[data-automation-id="jobPostingHeader"]').first();
				const $near = $hdr.closest('#mainContent, main, [role="main"], body');
				result.jobLocation = utils.firstNonEmpty(
					$near.find('[data-automation-id="locations"]').first().find("dd").first().text(),
					$hdr.closest("div").find('[data-automation-id="locations"] dd').first().text(),
					utils.parseTitleLocationFromTitle($('meta[property="og:title"]').attr("content")).location,
					utils.parseTitleLocationFromTitle(document.title).location,
				);
			}

			let wdHost = "";
			try {
				wdHost = new URL(wdPageBase).hostname;
			} catch (_e) {}
			if (wdHost) {
				const parts = wdHost.split(".");
				if (parts.length >= 4 && /^wd\d+$/i.test(parts[1])) {
					result.company = utils.cleanText(parts[0].replace(/-/g, " "));
				}
			}

			if (isWorkdayJobPostingUrl(utils.cleanText, pageUrl, wdPageBase)) {
				result.url = normalizeWorkdayJobUrl(utils.cleanText, pageUrl, wdPageBase);
			}
			if (!result.url) result.url = normalizeWorkdayJobUrl(utils.cleanText, utils.urlFromCanonicalOrOg($, utils.cleanText), wdPageBase);

			if (!result.url) {
				const $wdLinks = $jd.length
					? $jd.find('a[href*="/job/"], a[href*="/details/"]')
					: $(
							'section[data-automation-id="jobDetails"] a[href*="/job/"], section[data-automation-id="jobDetails"] a[href*="/details/"]',
						);
				$wdLinks.each(function () {
					const h = $(this).attr("href");
					const parsed = normalizeWorkdayJobUrl(utils.cleanText, h, wdPageBase);
					if (parsed) {
						result.url = parsed;
						return false;
					}
				});
			}
			if (!result.url) {
				$(
					'a[href*="myworkdayjobs.com"][href*="/job/"], a[href*="myworkdayjobs.com"][href*="/details/"]',
				).each(function () {
					const h = $(this).attr("href");
					const parsed = normalizeWorkdayJobUrl(utils.cleanText, h, wdPageBase);
					if (parsed) {
						result.url = parsed;
						return false;
					}
				});
			}

			return result;
		},

		parseEmbedded: (context, evidenceUrl) => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;

			const locationFromRadancyMeta = () => {
				const raw =
					$('meta[name="dimension7"]').attr("content") ||
					$('meta[name="gtm_tbcn_location"]').attr("content");
				if (!raw) return "";
				const parts = raw.split("~").map(s => utils.cleanText(s)).filter(Boolean);
				return parts.join(", ");
			};

			const locationFromCareerSiteParagraph = () =>
				utils.firstNonEmpty(
					utils.cleanText($('.position-location-12ZUO, [class*="position-location"]').first().text()),
					utils.cleanText(
						$('[aria-current="true"] [class*="fieldValue"], [aria-current="true"] [class*="position-location"]')
							.first()
							.text(),
					),
					utils.cleanText($('p[class*="__location"]').first().text()),
				);
			const locationLikeText = raw => {
				const t = utils.cleanText(raw);
				if (!t) return "";
				if (t.length < 2 || t.length > 120) return "";
				if (/^(search for location|location|apply|share)$/i.test(t)) return "";
				if (/^\d+(\.\d+)?\s*(km|mi|miles?)$/i.test(t)) return "";
				if (/\bRemote\b/i.test(t)) return t;
				if (/,/.test(t) && /\b[A-Z]{2}\b/.test(t)) return t;
				if (/,/.test(t) && /\b(United States|Canada|India|Taiwan|Germany|France|Japan|China|Ireland)\b/i.test(t))
					return t;
				if (/^[A-Za-z.\-'\s]+,\s*[A-Za-z.\-'\s]+$/.test(t)) return t;
				return "";
			};
			const locationFromNvidiaStyleFieldValues = () => {
				let found = "";
				$(
					'[class*="fieldValue"], [class*="subData"], [class*="tag-pills"], [id*="location-pill"], [data-testid*="location"]',
				).each(function () {
					if (found) return false;
					const picked = locationLikeText($(this).text());
					if (picked) {
						found = picked;
						return false;
					}
				});
				return found;
			};
			const extractWorkdayPid = rawUrl => {
				if (!rawUrl) return "";
				try {
					const u = new URL(rawUrl, "https://example.com");
					const byQuery = utils.cleanText(u.searchParams.get("pid"));
					if (/^\d{6,}$/.test(byQuery)) return byQuery;
					const byPath = (u.pathname || "").match(/\/job\/(\d{6,})/i);
					return byPath ? byPath[1] : "";
				} catch (_e) {
					return "";
				}
			};
			const locationFromPidScopedCard = pid => {
				if (!pid) return "";
				let $card = $(`#job-card-${pid}-job-list`).first();
				if (!$card.length) $card = $(`a[href*="/job/${pid}"]`).first();
				if (!$card.length) $card = $(`a[aria-label*="${pid}"]`).first();
				if (!$card || !$card.length) return "";

				let found = "";
				$card
					.find('[class*="fieldValue"], [class*="position-location"], [id*="location-pill"]')
					.each(function () {
						if (found) return false;
						const picked = locationLikeText($(this).text());
						if (picked) {
							found = picked;
							return false;
						}
					});
				return found;
			};
			const titleFromCardNode = $card => {
				if (!$card || !$card.length) return "";
				const byClass = utils.cleanText($card.find('[class*="title"]').first().text());
				if (byClass) return byClass;
				const aria = utils.cleanText($card.attr("aria-label"));
				const m = aria.match(/^View\s+job:\s*(.+)$/i);
				return m ? utils.cleanText(m[1]) : "";
			};
			const titleFromPidScopedCard = pid => {
				if (!pid) return "";
				let $card = $(`#job-card-${pid}-job-list`).first();
				if (!$card.length) $card = $(`a[href*="/job/${pid}"]`).first();
				if (!$card.length) $card = $(`a[aria-label*="${pid}"]`).first();
				return titleFromCardNode($card);
			};
			const titleFromActiveCard = () => {
				const $active = $('[aria-current="true"], .selected-3V9EA').first();
				return titleFromCardNode($active);
			};

			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };
			const wdPageBase = pageUrl.startsWith("http") ? pageUrl : `https://${pageUrl}`;
			const $jd = $('[data-automation-id="jobDetails"]');
			const liveUrl = typeof location !== "undefined" ? location.href : "";
			const pid = extractWorkdayPid(liveUrl) || extractWorkdayPid(pageUrl) || extractWorkdayPid(evidenceUrl);

			result.jobTitle = utils.firstNonEmpty(
				titleFromPidScopedCard(pid),
				titleFromActiveCard(),
				($jd.length ? $jd : $(document)).find('[data-automation-id="jobPostingHeader"]').first().text(),
				$('[data-automation-id="jobPostingHeader"]').first().text(),
				utils.parseTitleLocationFromTitle($('meta[property="og:title"]').attr("content")).title,
				utils.parseTitleLocationFromTitle(document.title).title,
			);

			result.jobLocation = utils.firstNonEmpty(
				$jd.find('[data-automation-id="locations"]').first().find("dd").first().text(),
				locationFromPidScopedCard(pid),
				locationFromCareerSiteParagraph(),
				locationFromNvidiaStyleFieldValues(),
				locationFromRadancyMeta(),
				utils.parseTitleLocationFromTitle($('meta[property="og:title"]').attr("content")).location,
				utils.parseTitleLocationFromTitle(document.title).location,
			);

			result.url = normalizeWorkdayJobUrl(utils.cleanText, evidenceUrl, wdPageBase);

			const titleBits = utils.cleanText(document.title).split(/\s*\|\s*/).map(utils.cleanText).filter(Boolean);
			result.company = utils.firstNonEmpty(
				utils.titleCaseWords(
					utils.cleanText(
						$('a[data-automation-id="logoLink"]').text() ||
							$('a[data-automation-id="logoLink"] img[alt]').attr("alt"),
					).replace(/search for jobs|careers?/i, ""),
				),
				titleBits.length >= 2 ? utils.titleCaseWords(titleBits[titleBits.length - 1]) : "",
			);
			if (!result.company && result.url) {
				try {
					const host = new URL(result.url).hostname;
					const sub = host.split(".")[0];
					if (sub) result.company = utils.titleCaseWords(sub.replace(/[-_]+/g, " "));
				} catch (_e) {}
			}

			return result;
		},
	});
})();
