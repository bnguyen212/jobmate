(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "jobs.lever.co",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $ } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			result.jobTitle =
				utils.cleanText($(".posting-headline h2").first().text()) ||
				utils.cleanText($(".content .posting-header h2").first().text());

			result.jobLocation = utils.cleanText($(".posting-categories .posting-category.location").first().text());
			if (!result.jobLocation) {
				const twLabel = utils.cleanText($('meta[name="twitter:label1"]').attr("content"));
				if (twLabel.toLowerCase() === "location") {
					result.jobLocation = utils.cleanText($('meta[name="twitter:data1"]').attr("content"));
				}
			}

			const logoAlt = $("a.main-header-logo img[alt]").attr("alt");
			if (logoAlt) result.company = utils.cleanText(String(logoAlt).replace(/\s+logo\s*$/i, ""));

			const leverTitleParts = raw => {
				const t = utils.cleanText(raw);
				const idx = t.indexOf(" - ");
				if (idx === -1) return null;
				return { left: utils.cleanText(t.slice(0, idx)), right: utils.cleanText(t.slice(idx + 3)) };
			};
			const ogTitle = $('meta[property="og:title"]').attr("content");
			const companyAndTitleFromMeta = leverTitleParts(ogTitle) || leverTitleParts(document.title);
			if (companyAndTitleFromMeta) {
				if (!result.company) result.company = companyAndTitleFromMeta.left;
				if (!result.jobTitle) result.jobTitle = companyAndTitleFromMeta.right;
			}

			result.url = utils.urlFromCanonicalOrOg($, utils.cleanText);
			return result;
		},
	});
})();
