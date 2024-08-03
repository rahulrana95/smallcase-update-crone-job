
const { Client } = require("pg");
require('dotenv').config();

const keys = {
  csrfToken: process.env.csrftoken,
  cookies: process.env.cookies,
};

function formatNumberToLakhsCrores(number) {
  if (typeof number !== "number" || isNaN(number)) {
    throw new TypeError("Input must be a valid number");
  }

  // Determine if negative
  const isNegative = number < 0;
  if (isNegative) number = -number; // Work with the absolute value

  // Define formatting thresholds (1 lakh = 100,000, 1 crore = 10,000,000)
  const lakhThreshold = 100000;
  const croreThreshold = 10000000;

  let formattedNumber;

  if (number < croreThreshold) {
    // convert each value to crores
    const crores = (number / croreThreshold).toFixed(5);
    formattedNumber = crores;
  } else {
    const crores = (number / croreThreshold).toFixed(5);
    formattedNumber = crores;
  }

  return isNegative ? `- ${formattedNumber}` : formattedNumber;
}

// fetch(
//   "https://api.smallcase.com/sam/investment?assetType[]=smallcase&pageSize=99999",
//   {
//     headers: {
//       accept: "application/json, text/plain, */*",
//       "accept-language": "en-US,en;q=0.9",
//       priority: "u=1, i",
//       "sec-ch-ua":
//         '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
//       "sec-ch-ua-mobile": "?0",
//       "sec-ch-ua-platform": '"macOS"',
//       "sec-fetch-dest": "empty",
//       "sec-fetch-mode": "cors",
//       "sec-fetch-site": "same-site",
//       "x-csrf-token": keys.csrfToken,
//       "x-sc-api-version": "v2",
//       "x-sc-broker": "groww",
//       "x-sc-publisher": "smallcase-website",
//       "x-sc-publishertype": "distributor",
//       "x-sc-source": "web",
//       "x-sc-version": "8.59.0",
//       cookie: keys.cookies,
//       Referer: "https://www.smallcase.com/",
//       "Referrer-Policy": "strict-origin-when-cross-origin",
//     },
//     body: null,
//     method: "GET",
//   }
// )
//   .then((response) => response.json())
//   .then((response) => console.log(response));

const smallcaseData = {
  totalReturns: "",
  netPL: "",
};

const client = new Client({
  connectionString: process.env.dbURL,
  ssl: {
    rejectUnauthorized: false, // This disables strict SSL certificate verification
  }
});


function displayError(message) {
  displayBox(message, "31");
}

function displaySuccess(message) {
  displayBox(message, "32");
}

function displayInfo(message) {
  displayBox(message, "34");
}

function displayBox(message, colorCode) {
  let messageStr;

  if (typeof message === "object") {
    messageStr = JSON.stringify(message, null, 2);
  } else {
    messageStr = String(message);
  }

  const lines = messageStr.split("\n");
  const maxLength = Math.max(...lines.map((line) => line.length));
  const paddedLines = lines.map((line) => line.padEnd(maxLength));

  const topBorder = `\x1b[${colorCode}m\x1b[1m\x1b[4m${".".repeat(
    maxLength + 4
  )}\x1b[0m`;
  const boxLines = paddedLines.map(
    (line) => `\x1b[${colorCode}m* ${line} *\x1b[0m`
  );
  const bottomBorder = `\x1b[${colorCode}m\x1b[1m\x1b[4m${".".repeat(
    maxLength + 4
  )}\x1b[0m`;

  console.log(topBorder);
  boxLines.forEach((line) => console.log(line));
  console.log(bottomBorder);
}

async function connectToDb() {
  try {
    if (!client._connected) {
      await client.connect();
      displaySuccess("Connection successful");
    } else {
      displayInfo("Already connected to the database");
    }
  } catch (err) {
    displayError("Error connecting to the database: " + err.message);
  }
}

async function fetchLast5Rows() {
  try {
    await connectToDb();
    const fetchLast5Query = `
        SELECT *
        FROM smallcaseInvestment
        ORDER BY date DESC
        LIMIT 5;
      `;

    const result = await client.query(fetchLast5Query);

    // Displaying the fetched rows
    console.log('Last 5 rows:');
    console.table(result.rows); // Using console.table for formatted output

  } catch (err) {
    console.error('Error fetching last 5 rows:', err.message);
  } finally {
  }
}

async function createTable() {
  await connectToDb()

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS smallcaseInvestment (
      id SERIAL PRIMARY KEY,
      totalValue TEXT,
      totalReturns TEXT,
      totalReturnPercentage TEXT,
      date DATE UNIQUE
    );
  `;

  try {
    await client.query(createTableQuery);
    displaySuccess("Table created successfully.");
  } catch (err) {
    displayError("Error creating table:", err);
  } finally {
    //displaySuccess("client closed")
  }
}



async function insertData(
  totalValue,
  totalReturns,
  totalReturnPercentage,
  date
) {

//   await client.query(`ALTER TABLE smallcaseInvestment 
// ADD CONSTRAINT unique_date UNIQUE (date);`);

  const checkDateQuery = "SELECT * FROM smallcaseInvestment WHERE date = $1";
  const insertDataQuery = `
    INSERT INTO smallcaseInvestment (totalValue, totalReturns, totalReturnPercentage, date)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (date) DO NOTHING;
  `;

  try {
    const res = await client.query(checkDateQuery, [date]);
    if (res.rows.length === 0) {
      const res32 = await client.query(insertDataQuery, [
        totalValue,
        totalReturns,
        totalReturnPercentage,
        date,
      ]);

      console.log(res32)
      displaySuccess("Data inserted successfully.");
    } else {
      displayError("Data for this date already exists.");
    }
  } catch (err) {
    displayError("Error inserting data:");
    displayError(err);
    console.log(err);
  } finally {
    // await client.end();
    // displaySuccess("client closed")
  }
}


function getFormattedDate() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}/${month}/${day}`;
}

fetch("https://api.smallcase.com/sam/investment/total", {
  headers: {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    priority: "u=1, i",
    "sec-ch-ua":
      '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-csrf-token": keys.csrfToken,
    "x-sc-broker": "groww",
    "x-sc-publisher": "smallcase-website",
    "x-sc-publishertype": "distributor",
    "x-sc-source": "web",
    "x-sc-version": "8.59.0",
    cookie: keys.cookies,
    Referer: "https://www.smallcase.com/",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  },
  body: null,
  method: "GET",
})
  .then((response) => response.json())
  .then((response) => {
    const { returns } = response.data.total;
    smallcaseData.totalReturns = formatNumberToLakhsCrores(returns.networth);
    smallcaseData.netPL = formatNumberToLakhsCrores(returns.totalPnl);
    smallcaseData.totalPnlPercent = returns.totalPnlPercent.toFixed(5);

    console.log("Here is data from smallcase");
    displayInfo(smallcaseData);

    // Example usage
    (async () => {
      await createTable();
      await insertData(
        smallcaseData.totalReturns,
        smallcaseData.netPL,
        smallcaseData.totalPnlPercent,
        getFormattedDate()
      );
      await fetchLast5Rows();
      await client.end();
    })();
  })
  .catch((err) => {
    displayError(err);
    displayError("Something is wrong in fetching net value from smallcase.");
  }).finally(async () => {

  });
