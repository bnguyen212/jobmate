(function () {
	const api = window.JobMateParsers;
	const safeAbsUrl = window.JobMateUtils && window.JobMateUtils.safeAbsUrl;
	if (!api || !safeAbsUrl) return;

	const normalizeTaleoJobUrl = (cleanText, href, base) => {
		const absoluteUrl = safeAbsUrl(cleanText, href, base);
		if (!absoluteUrl) return "";
		try {
			const parsed = new URL(absoluteUrl);
			const isTaleoPath =
				/\/careersection\//i.test(parsed.pathname) ||
				/(jobdetail\.ftl|viewRequisition)/i.test(parsed.pathname);
			if (!isTaleoPath) return "";
			if (/(login|\/apply)/i.test(parsed.pathname)) return "";
			parsed.hash = "";
			return cleanText(parsed.href);
		} catch (_e) {
			return "";
		}
	};

	const taleoReqTitle = ($, utils) =>
		utils.cleanText($('[id="requisitionDescriptionInterface.reqTitleLinkAction.row1"]').first().text());

	const taleoLabeledRow = ($, utils, labelPatterns) => {
		let matchedCellText = "";
		$(".contentlinepanel").each(function () {
			const $panel = $(this);
			const $h2 = $panel.find("> h2").first();
			if (!$h2.length) return;
			const label = utils.cleanText($h2.find(".subtitle").first().text());
			if (!label || !labelPatterns.some(re => re.test(label))) return;
			let $valueSpan = $panel.find("> span.text").first();
			if (!$valueSpan.length)
				$valueSpan = $panel.find(".inlinepanel .text, .inlinepanel span.text").first();
			if (!$valueSpan.length) return;
			const cellText = utils.cleanText($valueSpan.text());
			if (cellText && cellText.length < 400) {
				matchedCellText = cellText;
				return false;
			}
		});
		return matchedCellText;
	};

	/** "Organization" often holds a branch/site code (e.g. "833 - Amarillo TX"), not legal employer name. */
	const taleoCompanyFromLabeledRow = ($, utils) => {
		const raw = taleoLabeledRow($, utils, [/^organization$/i, /^company$/i, /^employer$/i]);
		if (!raw) return "";
		if (/^\d+\s*-\s*/.test(raw)) return "";
		return raw;
	};

	const taleoCompanyFromLogo = ($, utils) => {
		const alt =
			$(".unihead img[alt]").first().attr("alt") ||
			$("header img[alt]").first().attr("alt") ||
			$('[class*="branding"] img[alt]').first().attr("alt") ||
			$('img[class*="logo"][alt]').not('[src*="cart"]').first().attr("alt");
		if (!alt) return "";
		return utils.cleanText(String(alt).replace(/\s+logo\s*$/i, ""));
	};

	const taleoJobLocationFromDom = ($, utils) => {
		const taleoFtlWorkSiteLocation = () => {
			const site = utils.cleanText($('[id="requisitionDescriptionInterface.reqSiteName.row1"]').text());
			const line1 = utils.cleanText(
				$('[id="requisitionDescriptionInterface.reqSiteAddressLine1.row1"]').text(),
			);
			const line2 = utils.cleanText(
				$('[id="requisitionDescriptionInterface.reqSiteAddressLine2.row1"]').text(),
			);
			const city = utils.cleanText($('[id="requisitionDescriptionInterface.reqSiteCity.row1"]').text());
			const zip = utils.cleanText($('[id="requisitionDescriptionInterface.reqSiteZipCode.row1"]').text());
			const parts = [site, line1, line2, city, zip].filter(Boolean);
			return parts.length ? utils.cleanText(parts.join(", ")) : "";
		};

		const $taleoCwsWell = $(".oracletaleocwsv2-job-description").first();
		const taleoCwsV2Location = () => {
			let locationFromLabelRow = "";
			$taleoCwsWell.find("span.small").each(function () {
				if (!/^location$/i.test(utils.cleanText($(this).text()))) return;
				locationFromLabelRow =
					utils.cleanText($(this).next("strong").first().text()) ||
					utils.cleanText($(this).parent().find("strong").first().text());
				if (locationFromLabelRow) return false;
			});
			return locationFromLabelRow;
		};

		const taleoLocationFromOgTitle = og => {
			const ogTitleText = utils.cleanText(og);
			if (!ogTitleText) return "";
			const titleSegments = ogTitleText.split(/\s*-\s*/).map(utils.cleanText).filter(Boolean);
			if (titleSegments.length < 2) return "";
			const lastSegment = titleSegments[titleSegments.length - 1];
			if (lastSegment.length < 200 && /,\s*[A-Z]{2}\s*$/.test(lastSegment)) return lastSegment;
			return "";
		};

		const fromTitleRegex = () => {
			const t =
				taleoReqTitle($, utils) || utils.cleanText($('meta[property="og:title"]').attr("content"));
			if (!t) return "";
			const m = t.match(/\s-\s([A-Z]{2}),\s*([^([]]+?)\s*\(\d{3,}\)\s*$/);
			return m ? `${m[1]}, ${utils.cleanText(m[2])}` : "";
		};

		return utils.firstNonEmpty(
			taleoFtlWorkSiteLocation(),
			taleoLabeledRow($, utils, [
				/^primary location$/i,
				/^location$/i,
				/^job location$/i,
				/^work locations?$/i,
			]),
			taleoCwsV2Location(),
			fromTitleRegex(),
			taleoLocationFromOgTitle($('meta[property="og:title"]').attr("content")),
		);
	};

	api.register({
		domain: "taleo.net",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const $taleoCwsWell = $(".oracletaleocwsv2-job-description").first();
			const taleoCwsV2Title = () =>
				utils.cleanText($taleoCwsWell.children("strong").first().text());

			result.jobTitle = utils.firstNonEmpty(
				taleoReqTitle($, utils),
				taleoCwsV2Title(),
				$('meta[property="og:title"]').attr("content"),
			);
			if (!result.jobTitle) {
				const dt = utils.cleanText(document.title);
				const m = dt.match(/^Job Description\s*-\s*(.+)$/i);
				if (m) result.jobTitle = utils.cleanText(m[1]);
			}

			result.jobLocation = taleoJobLocationFromDom($, utils);

			result.company = utils.firstNonEmpty(
				taleoCompanyFromLogo($, utils),
				taleoCompanyFromLabeledRow($, utils),
				$('meta[property="og:site_name"]').attr("content"),
			);
			if (!result.company) {
				try {
					const host = new URL(pageUrl).hostname;
					const sub = host.replace(/\.taleo\.net$/i, "").trim();
					if (sub) result.company = utils.titleCaseWords(sub.replace(/[-_.]+/g, " "));
				} catch (_e) {}
			}

			result.url = utils.firstNonEmpty(
				normalizeTaleoJobUrl(utils.cleanText, utils.urlFromCanonicalOrOg($, utils.cleanText), pageUrl),
				normalizeTaleoJobUrl(utils.cleanText, pageUrl, pageUrl),
			);
			return result;
		},
	});
})();
