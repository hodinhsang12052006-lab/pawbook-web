"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var playwright_extra_1 = require("playwright-extra");
var mongodb_1 = require("mongodb");
// Add stealth plugin to Playwright using CommonJS require to avoid default import runtime errors
var stealthPlugin = require("puppeteer-extra-plugin-stealth");
// @ts-ignore
playwright_extra_1.chromium.use(stealthPlugin());
// MongoDB configuration
var MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
var DB_NAME = "pawbook_data_mining";
var COLLECTION_NAME = "jobs";
// Helper for generating random delays (anti-ban)
var sleep = function (minMs, maxMs) {
    var ms = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
};
function scrapeJobs() {
    return __awaiter(this, void 0, void 0, function () {
        var client, db, collection, proxyServer, browser, context, page, jobBoardUrl, jobs, _i, jobs_1, item, nowInVN, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🚀 Starting Job Scraper...");
                    client = new mongodb_1.MongoClient(MONGO_URI);
                    return [4 /*yield*/, client.connect()];
                case 1:
                    _a.sent();
                    db = client.db(DB_NAME);
                    collection = db.collection(COLLECTION_NAME);
                    // Ensure unique index for Job Url to support upsert logic
                    return [4 /*yield*/, collection.createIndex({ sourceUrl: 1 }, { unique: true })];
                case 2:
                    // Ensure unique index for Job Url to support upsert logic
                    _a.sent();
                    proxyServer = process.env.PROXY_SERVER;
                    return [4 /*yield*/, playwright_extra_1.chromium.launch({
                            headless: true,
                            args: ["--no-sandbox", "--disable-setuid-sandbox"],
                            proxy: proxyServer ? { server: proxyServer } : undefined
                        })];
                case 3:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newContext({
                            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            viewport: { width: 1280, height: 720 }
                        })];
                case 4:
                    context = _a.sent();
                    return [4 /*yield*/, context.newPage()];
                case 5:
                    page = _a.sent();
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 14, 15, 18]);
                    jobBoardUrl = "https://examplesite.com/jobs?q=veterinary+pet+care";
                    console.log("\uD83D\uDD0D Crawling target page: ".concat(jobBoardUrl));
                    return [4 /*yield*/, page.goto(jobBoardUrl, { waitUntil: "domcontentloaded", timeout: 30000 })];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, sleep(3000, 7000)];
                case 8:
                    _a.sent(); // Random delay
                    return [4 /*yield*/, page.$$eval(".job-card", function (elements) {
                            return elements.map(function (el) {
                                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                                var companyName = ((_b = (_a = el.querySelector(".company")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "";
                                var position = ((_d = (_c = el.querySelector(".title")) === null || _c === void 0 ? void 0 : _c.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || "";
                                var salary = ((_f = (_e = el.querySelector(".salary")) === null || _e === void 0 ? void 0 : _e.textContent) === null || _f === void 0 ? void 0 : _f.trim()) || "Thỏa thuận";
                                var location = ((_h = (_g = el.querySelector(".location")) === null || _g === void 0 ? void 0 : _g.textContent) === null || _h === void 0 ? void 0 : _h.trim()) || "";
                                var requirements = ((_k = (_j = el.querySelector(".requirements")) === null || _j === void 0 ? void 0 : _j.textContent) === null || _k === void 0 ? void 0 : _k.trim()) || "";
                                var sourceUrl = ((_l = el.querySelector("a.apply-link")) === null || _l === void 0 ? void 0 : _l.href) || "";
                                return {
                                    companyName: companyName,
                                    position: position,
                                    salary: salary,
                                    location: location,
                                    requirements: requirements,
                                    sourceUrl: sourceUrl
                                };
                            });
                        })];
                case 9:
                    jobs = _a.sent();
                    console.log("\uD83D\uDCC8 Extracted ".concat(jobs.length, " jobs."));
                    _i = 0, jobs_1 = jobs;
                    _a.label = 10;
                case 10:
                    if (!(_i < jobs_1.length)) return [3 /*break*/, 13];
                    item = jobs_1[_i];
                    nowInVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
                    if (nowInVN.getHours() >= 10) {
                        console.log("⏰ Time limit reached (>= 10:00 AM Asia/Ho_Chi_Minh). Stopping execution...");
                        return [3 /*break*/, 13];
                    }
                    if (!item.sourceUrl)
                        return [3 /*break*/, 12];
                    return [4 /*yield*/, collection.updateOne({ sourceUrl: item.sourceUrl }, {
                            $set: __assign(__assign({}, item), { lastCrawledAt: new Date() })
                        }, { upsert: true })];
                case 11:
                    _a.sent();
                    _a.label = 12;
                case 12:
                    _i++;
                    return [3 /*break*/, 10];
                case 13: return [3 /*break*/, 18];
                case 14:
                    err_1 = _a.sent();
                    console.error("❌ Error scraping jobs:", err_1);
                    return [3 /*break*/, 18];
                case 15: return [4 /*yield*/, browser.close()];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, client.close()];
                case 17:
                    _a.sent();
                    console.log("🏁 Job Scraper Finished.");
                    return [7 /*endfinally*/];
                case 18: return [2 /*return*/];
            }
        });
    });
}
// Self execution check
if (require.main === module) {
    scrapeJobs().catch(console.error);
}
