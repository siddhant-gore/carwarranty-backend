class APIFeatures {
	constructor(query, queryStr) {
		this.query = query;
		this.queryStr = queryStr;
	}

	search() {
		const searchTerms = this.queryStr?.keyword;
	
		if (searchTerms) {
			const keywordQuery = {
				$or: [
					
					{ email: { $regex: searchTerms, $options: 'i' } },
					
				//	{ amount:  parseInt(searchTerms) },
					{ mobile_no: { $regex: searchTerms, $options: 'i' } },
					{ firstname: { $regex: searchTerms, $options: 'i' } },
					{ lastname: { $regex: searchTerms, $options: 'i' } },
					{ plan: { $regex: searchTerms, $options: 'i' } },
					
					
				]
			};
	
			try {
				this.query = this.query.find(keywordQuery);
			} catch (error) {
				console.error("Search error: ",error);
			}
			
		}
		return this;
	}
	

	filter() {
		const queryCopy = { ...this.queryStr }

		// Removing field for category
		const removeFields = ["keyword", "currentPage", "resultPerPage"];
		removeFields.forEach(key => delete queryCopy[key]);

		// filter for price
		let querystr = JSON.stringify(queryCopy);
		querystr = querystr.replace(/\b(gt|gte|lt|lte)\b/g, (key) => `$${key}`);

		this.query = this.query.find(JSON.parse(querystr));
		return this;
	}

	pagination() {
		const currentPage = parseInt(this.queryStr.currentPage);
		const resultPerPage = parseInt(this.queryStr.resultPerPage);

		const skip = resultPerPage * (currentPage - 1);

		this.query = this.query.limit(resultPerPage).skip(skip);
		return this;
	}
}

module.exports = APIFeatures