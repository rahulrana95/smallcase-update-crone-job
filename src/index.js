// scbrokergateway.userInvestments({
//   gatewayname: 'gatewaydemo',
//   aggregatedData: 'true',
//   'x-gateway-secret': 'gatewayDemo_secret',
//   'x-gateway-authtoken': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzbWFsbGNhc2VBdXRoSWQiOiI2MzFmYWQwMWQ5ZmU3YmEzNGI2YzBhM2EiLCJleHAiOjE5MDAwMDAwMDB9.-_6ykYyKke4xuKImlYEPTX9fJhLoMU86qMHRX0YY6eA'
// })
//   .then(({ data }) => console.log(data))
//   .catch(err => console.error(err));

const keys = {
  csrfToken: process.env.csrfToken,
  cookies: process.env.cookies,
};
const { Client } = require("pg");
require('dotenv').config();


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

  if (number < lakhThreshold) {
    formattedNumber = number.toLocaleString("en-IN");
  } else if (number < croreThreshold) {
    const lakhs = (number / lakhThreshold).toFixed(2);
    formattedNumber = `${lakhs} Lakh`;
  } else {
    const crores = (number / croreThreshold).toFixed(2);
    formattedNumber = `${crores} Crore`;
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
  return `${day}-${month}-${year}`;
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
    "x-csrf-token": "fd8f7c9c",
    "x-sc-broker": "groww",
    "x-sc-publisher": "smallcase-website",
    "x-sc-publishertype": "distributor",
    "x-sc-source": "web",
    "x-sc-version": "8.59.0",
    cookie:
      "_gcl_au=1.1.1114216023.1719931039; WZRK_G=4bc667c73ee049b597f28963b57f2f76; _fbp=fb.1.1719931039052.463658326727016648; _hjSessionUser_586592=eyJpZCI6ImFjMjRmZTVhLTkwN2ItNTM1OC1iODJhLTg2OGNhYWJiMzRlMyIsImNyZWF0ZWQiOjE3MTk5MzEwMzg3NzQsImV4aXN0aW5nIjp0cnVlfQ==; intercom-id-y72tx0ov=58aef04f-428e-428a-be5c-9b2d896a2986; intercom-session-y72tx0ov=; intercom-device-id-y72tx0ov=78d2eeca-8323-421b-8d59-cf4526a47038; _hjSessionUser_3410224=eyJpZCI6ImEyOWFhZTliLTk1YmItNTk0MC1hMjY3LWRmNzJjMTNjOTNhYSIsImNyZWF0ZWQiOjE3MjAxNzg5MTU4ODksImV4aXN0aW5nIjpmYWxzZX0=; _hjSessionUser_1355230=eyJpZCI6IjAxOWY1NGY5LTdjZWMtNWVmZC1iOTNjLTIyYWYzNWI5YThmZCIsImNyZWF0ZWQiOjE3MjAxODM5MzAyMjYsImV4aXN0aW5nIjpmYWxzZX0=; _ga_V01HMK3GWT=GS1.2.1720183935.1.0.1720183935.0.0.0; _ga_8JVRMSPJFT=GS1.1.1720184040.1.0.1720184040.0.0.0; _ga_EK3JCJGW74=GS1.1.1720183932.1.1.1720184220.60.0.0; _ga_FTSXRWC4JZ=GS1.1.1720183932.1.1.1720184220.60.0.0; jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI2NGQzYTU1ZGQ5ZjBlNTM2ZTRhYjkzZDEiLCJzZXNzaW9uIjoiZjI5NDhlM2IiLCJjc3JmIjoiYTg1ZTJlOGYiLCJhY2Nlc3MiOnsicGxhdGZvcm0iOnRydWV9LCJtZXRob2QiOiJicm9rZXIiLCJhcHAiOiJwbGF0Zm9ybSIsIm5vT3JkZXIiOnRydWUsImJyb2tlciI6Imdyb3d3IiwiaWF0IjoxNzIwNDM2NTAyLCJleHAiOjE3MjEwNDEzMDJ9.e7eAzE7LBO59sy0zR9DXV61cdbs3NcjHyNxTj5uolDE; _ga=GA1.1.320320872.1720184040; _ga_W8CJJWRPNQ=GS1.1.1720438400.1.1.1720438584.52.0.0; _hjSession_586592=eyJpZCI6ImJkYTg4M2VlLWIxMWEtNDYyMC1iODUwLTI4NjY0NTg4MGQ0OCIsImMiOjE3MjA1ODQ3NzAzMTksInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MX0=; sam=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzYW1JZCI6IjY0ZDNhNDhkYWM4Y2M2YjkwZGY4NjA3NCIsInNhbVNlc3Npb25JZCI6IjBlYzg0MWQyY2ZiZGFkZjAiLCJzZXNzaW9uIjoiMGVjODQxZDJjZmJkYWRmMCIsImNzcmYiOiJmZDhmN2M5YyIsImFjY2VzcyI6eyJwbGF0Zm9ybSI6dHJ1ZX0sIm1ldGhvZCI6InBob25lX251bWJlciIsIm5vT3JkZXIiOnRydWUsInVzZXJJZCI6IjY0ZDNhNTVkZDlmMGU1MzZlNGFiOTNkMSIsImJyb2tlciI6Imdyb3d3IiwiaWF0IjoxNzIwMTc4ODYxLCJleHAiOjE3MjExODk1Nzh9.V90ndqnQK_yg01z7HwcAwwQCObYV5TKJjiR7CT7Jv8QAXgiCCnjVOf9AIVsZbQynLN554Y_ZpgrlLgrq3Hj37KjMAI3wO2jt78UAFNczYAmtlWweZW4w5pivY9kqtTcLNlY53YWvlhgyG_y1kH9DiK8az0cFBQqhYTeFXKGF6km0ZORSYdhAlvHzJeXDcwK5n0bzXfuJXbFlkhK9nzMSVrLdN7pGBOD-XHcXb-LCZwERyFRAXNCeQ4t7QvqGsiYQI4y4cerIY5Z-N-KpR44_f_U11lRAoWBflumtyrMcPMLqJNLMPF5UeBaY655LVwqrcM2hLgDGa0ODW2WSm0xQiQ; mp_7b1e06d0192feeac86689b5599a4b024_mixpanel=%7B%22distinct_id%22%3A%20%2264d3a48dac8cc6b90df86076%22%2C%22%24device_id%22%3A%20%2219073e0eb7e117-09c51c456ad91c-19525637-1d73c0-19073e0eb7e117%22%2C%22%24search_engine%22%3A%20%22google%22%2C%22%24initial_referrer%22%3A%20%22https%3A%2F%2Fwww.google.com%2F%22%2C%22%24initial_referring_domain%22%3A%20%22www.google.com%22%2C%22__mps%22%3A%20%7B%7D%2C%22__mpso%22%3A%20%7B%7D%2C%22__mpus%22%3A%20%7B%7D%2C%22__mpa%22%3A%20%7B%7D%2C%22__mpu%22%3A%20%7B%7D%2C%22__mpr%22%3A%20%5B%5D%2C%22__mpap%22%3A%20%5B%5D%2C%22%24user_id%22%3A%20%2264d3a48dac8cc6b90df86076%22%7D; _ga_K2HPEKS78Z=GS1.1.1720584770.5.1.1720584778.52.0.0; WZRK_S_466-K7W-KZ5Z=%7B%22p%22%3A2%2C%22s%22%3A1720584770%2C%22t%22%3A1720584779%7D",
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
    smallcaseData.totalPnlPercent = `${formatNumberToLakhsCrores(
      returns.totalPnlPercent
    )} %`;

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
