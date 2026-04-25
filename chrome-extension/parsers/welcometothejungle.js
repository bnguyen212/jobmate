(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "welcometothejungle.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $ } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const escapeRegExp = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

			const $jobTitleEl = $('[data-testid="job-title"]').first();
			if ($jobTitleEl.length) {
				const companyNameFromLink = utils.cleanText($jobTitleEl.find("a").first().text());
				const jobTitleBlockText = utils.cleanText($jobTitleEl.text());
				if (companyNameFromLink) {
					result.company = companyNameFromLink;
					result.jobTitle = utils.cleanText(
						jobTitleBlockText
							.replace(new RegExp(`,\\s*${escapeRegExp(companyNameFromLink)}\\s*$`, "i"), "")
							.replace(/,\s*$/, ""),
					);
				} else {
					const commaSeparated = jobTitleBlockText.match(/^(.+),\s*(.+)$/);
					if (commaSeparated) {
						result.jobTitle = utils.cleanText(commaSeparated[1]);
						result.company = utils.cleanText(commaSeparated[2]);
					} else {
						result.jobTitle = jobTitleBlockText;
					}
				}
			}

			// Newer WTTJ pages often expose the role as <h2> inside metadata block
			// and do not render `data-testid="job-title"`.
			if (!result.jobTitle) {
				result.jobTitle = utils.cleanText(
					$('[data-testid="job-metadata-block"] h2, [data-testid="job-metadata-block"] h1')
						.first()
						.text(),
				);
			}

			if (!result.jobTitle) {
				const documentTitle = utils.cleanText(document.title);
				const titleBeforePipe = documentTitle.split(/\s*\|\s*/)[0];
				// "Role – Company – Contract in City" -> keep the role only.
				const titleBeforeDash = utils.cleanText(titleBeforePipe.split(/\s*[–—-]\s*/)[0]);
				if (titleBeforeDash && !/Welcome to the Jungle/i.test(titleBeforeDash))
					result.jobTitle = titleBeforeDash;
			}

			if (!result.company) result.company = utils.cleanText($('[data-testid="company-logo"] img[alt]').first().attr("alt"));
			if (!result.company) {
				result.company = utils.cleanText(
					$('[data-testid="job-metadata-block"] a[href*="/companies/"]').first().text(),
				);
			}
			if (!result.company) {
				result.company = utils.cleanText($('[data-testid="job-metadata-block"] img[alt]').first().attr("alt"));
			}

			if (result.jobTitle && result.company) {
				const companyPrefixInTitle = new RegExp(`^${escapeRegExp(result.company)}\\s+`, "i");
				if (companyPrefixInTitle.test(result.jobTitle))
					result.jobTitle = utils.cleanText(result.jobTitle.replace(companyPrefixInTitle, ""));
			}

			result.jobLocation = utils.cleanText($('[data-testid="job-location-tag"]').first().text());
			if (!result.jobLocation) {
				const parts = $('[data-testid="job-locations"] [data-testid="job-location-tag"]')
					.map(function () {
						return utils.cleanText($(this).text());
					})
					.get()
					.filter(Boolean);
				if (parts.length) result.jobLocation = parts.join(", ");
			}
			if (!result.jobLocation) {
				const $locationChip = $('[data-testid="job-metadata-block"] svg[alt="Location"]')
					.first()
					.closest('div[variant="default"]');
				if ($locationChip.length) result.jobLocation = utils.cleanText($locationChip.text());
			}

			result.url = utils.urlFromCanonicalOrOg($, utils.cleanText);
			return result;
		},
	});
})();
