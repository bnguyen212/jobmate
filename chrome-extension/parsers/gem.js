(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "jobs.gem.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $ } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			result.jobTitle =
				utils.cleanText($('#content [class*="jobPostingContent"] [class*="jobPostingHeader"]').first().text()) ||
				utils.cleanText($('[class*="jobPostingContent"] [class*="jobPostingHeader"]').first().text()) ||
				utils.cleanText(document.title);

			const gemBrand =
				utils.cleanText($('meta[property="og:title"]').attr("content")) ||
				utils.cleanText($('meta[name="application-name"]').attr("content")) ||
				utils.cleanText($('meta[name="apple-mobile-web-app-title"]').attr("content"));
			if (gemBrand) result.company = utils.cleanText(gemBrand.replace(/\s+Careers\s*$/i, "").trim());
			if (!result.company) {
				const aboutHeading = $('[class*="typography-39"] strong').first().text();
				const m = aboutHeading.match(/^About\s+(.+)$/i);
				if (m) result.company = utils.cleanText(m[1]);
			}

			const gemLocFromContainer = $container => {
				let firstLocationLabel = "";
				let locationLabelWithComma = "";
				$container.find('[class*="iconLabel"]').each(function () {
					const labelText = utils.cleanText($(this).text());
					if (!labelText) return;
					if (/^(Full-time|Part-time|Contract|Internship|Intern)$/i.test(labelText)) return;
					if (!firstLocationLabel) firstLocationLabel = labelText;
					if (/,/.test(labelText)) {
						locationLabelWithComma = labelText;
						return false;
					}
				});
				return utils.cleanText(locationLabelWithComma || firstLocationLabel);
			};

			result.jobLocation = gemLocFromContainer($('#content [class*="attributesContainer"]').first());
			if (!result.jobLocation) {
				result.jobLocation = gemLocFromContainer($('[class*="attributesContainer"]').first());
			}

			result.url = utils.urlFromCanonicalOrOg($, utils.cleanText);
			return result;
		},
	});
})();
