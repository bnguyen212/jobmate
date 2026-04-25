(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "jobvite.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $ } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			result.jobTitle =
				utils.cleanText($("article.jv-page-body h2.jv-header").first().text()) ||
				utils.cleanText($("h2.jv-header").first().text()) ||
				utils.cleanText($(".jv-job-detail h2").first().text());

			const logoAlt = utils.cleanText($(".jv-logo a img").first().attr("alt"));
			if (logoAlt) result.company = utils.cleanText(logoAlt.replace(/\s+Careers\s*$/i, "").trim());
			if (!result.company) {
				result.company = utils.cleanText(
					$(".jv-logo .sr-only, .jv-logo a .sr-only, .jv-page-header .jv-logo .sr-only")
						.first()
						.text()
						.replace(/\s+Careers\s*$/i, "")
						.trim(),
				);
			}
			if (!result.company) {
				const ogTitleRaw = $('meta[property="og:title"]').attr("content");
				const companyFromOgTitle =
					ogTitleRaw && utils.cleanText(ogTitleRaw).match(/^(.+?)\s+is looking for\s+/i);
				if (companyFromOgTitle) result.company = utils.cleanText(companyFromOgTitle[1]);
			}

			const $meta = $("p.jv-job-detail-meta").first();
			if ($meta.length) {
				const $sep = $meta.find(".jv-inline-separator").first();
				if ($sep.length) {
					let loc = "";
					let afterSep = false;
					$meta.contents().each(function () {
						if (afterSep) loc += $(this).text();
						else if (this === $sep.get(0)) afterSep = true;
					});
					result.jobLocation = utils.cleanText(loc);
				}
				if (!result.jobLocation) result.jobLocation = utils.cleanText($meta.text().replace(/[\n]/g, " "));
			}

			result.url = utils.urlFromCanonicalOrOg($, utils.cleanText);
			return result;
		},
	});
})();
