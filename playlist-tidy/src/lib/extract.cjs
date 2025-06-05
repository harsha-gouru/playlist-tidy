const fs = require("fs");
const jwt = require("jsonwebtoken");

const privateKey = fs.readFileSync("AuthKey_7DQT6R7D68.p8").toString();
const teamId = "8V5BPU7WJQ";
const keyId = "7DQT6R7D68";

const jwtToken = jwt.sign({}, privateKey, {
    algorithm: "ES256",
    expiresIn: "180d",
    issuer: teamId,
    header: {
        alg: "ES256",
        kid: keyId
    }
});
console.log(jwtToken);
