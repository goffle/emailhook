"use strict";
const http = require("http");
const AWS = require("aws-sdk");
const { simpleParser } = require("mailparser");

const EMAILBUCKET = "emailhook";

exports.handler = async event => {
  console.log("#0")
   const mailobject = await fetchMessage(event.Records[0]);
  console.log("#1")
  const obj = extractInfo(mailobject)
  console.log("#2")
  await postEmail(obj);
  return { statusCode: 200 };
};


function fetchMessage(record) {
  const messageId = record.ses.mail.messageId;
  // Copying email object to ensure read permission
  console.log({
    level: "info",
    message: "Fetching email at s3://" + EMAILBUCKET + "/" + messageId
  });

  const s3 = new AWS.S3({ signatureVersion: "v4" });

  return new Promise(function(resolve, reject) {
    s3.copyObject(
      {
        Bucket: EMAILBUCKET,
        CopySource: EMAILBUCKET + "/" + messageId,
        Key: messageId,
        ACL: "private",
        ContentType: "text/plain",
        StorageClass: "STANDARD"
      },
      function(err) {
        if (err) {
          console.log({
            level: "error",
            message: "copyObject() returned error:",
            error: err,
            stack: err.stack
          });
          return reject(
            new Error("Error: Could not make readable copy of email.")
          );
        }
        // Load the raw email from S3
        s3.getObject({ Bucket: EMAILBUCKET, Key: messageId }, async function(
          err,
          result
        ) {
          if (err) {
            console.log({
              level: "error",
              message: "getObject() returned error:",
              error: err,
              stack: err.stack
            });
            return reject(
              new Error("Error: Failed to load message body from S3.")
            );
          }
          const obj = await simpleParser(result.Body);
          return resolve(obj);
        });
      }
    );
  });
}

function postEmail(obj) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname:
        "datadvise-api-production.v3yc3pfj3u.eu-west-3.elasticbeanstalk.com",
      path: "/mail",
      method: "POST",
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "same-origin", // include, same-origin, *omit
      mode: "cors", // no-cors, cors, *same-origin
      redirect: "follow", // manual, *follow, error
      referrer: "no-referrer", // *client, no-referrer
      headers: {
        "Content-Type": "application/json"
      }
    };
    
    console.log("#4")

    const req = http.request(options, res => {
      res.setEncoding("utf8");
      res.on("data", response => {
        resolve(response);
      });
      res.on("error", err => {
        console.log("###9", err);
        reject(err);
        console.log("Error, with: " + err);
      });
    });

    req.on("error", e => {
      reject(e);
      console.error(`problem with request: ${e.message}`);
    });
  
    req.write(JSON.stringify(obj));
    req.end();
  });
}


function extractInfo(mail){
    const subject = mail.subject;
    const html = mail.html;
    const text = mail.text;
    const from = mail.from.value[0].address;
    const to = mail.to.value[0].address;
    
    return {subject, html,text,from,to}
}