"use strict";
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
var COLLECTION_NAME = "services";
var CITIES = [
    "Nha Trang",
    "Ho Chi Minh",
    "Ha Noi",
    "Da Nang",
    "Hai Phong",
    "Can Tho",
    "Bien Hoa"
];
// Helper for generating random delays (anti-ban)
var sleep = function (minMs, maxMs) {
    var ms = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
};
function scrapeServices() {
    return __awaiter(this, void 0, void 0, function () {
        var client, db, collection, proxyServer, browser, context, page, _i, CITIES_1, city, nowInVN, searchUrl, listPanelSelector, isEnd, lastHeight, scrollAttempts, panelHandle, newHeight, textContent, listingSelector, listingHandles, i, currentVNTime, elements, currentItem, detailData, currentUrl, coordinates, geoRegex, match, payload, query, closeBtn, itemErr_1, cityErr_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("🚀 Starting Google Maps Service Scraper...");
                    client = new mongodb_1.MongoClient(MONGO_URI);
                    return [4 /*yield*/, client.connect()];
                case 1:
                    _a.sent();
                    db = client.db(DB_NAME);
                    collection = db.collection(COLLECTION_NAME);
                    // Indexes to ensure query efficiency and avoid duplicates
                    return [4 /*yield*/, collection.createIndex({ phone: 1 }, { sparse: true })];
                case 2:
                    // Indexes to ensure query efficiency and avoid duplicates
                    _a.sent();
                    return [4 /*yield*/, collection.createIndex({ name: 1, address: 1 }, { unique: true })];
                case 3:
                    _a.sent();
                    proxyServer = process.env.PROXY_SERVER;
                    return [4 /*yield*/, playwright_extra_1.chromium.launch({
                            headless: true,
                            args: [
                                "--no-sandbox",
                                "--disable-setuid-sandbox",
                                "--disable-dev-shm-usage",
                                "--disable-gpu"
                            ],
                            proxy: proxyServer ? { server: proxyServer } : undefined
                        })];
                case 4:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newContext({
                            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            viewport: { width: 1280, height: 800 },
                            locale: "vi-VN" // Request Google Maps in Vietnamese
                        })];
                case 5:
                    context = _a.sent();
                    return [4 /*yield*/, context.newPage()];
                case 6:
                    page = _a.sent();
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, , 40, 43]);
                    _i = 0, CITIES_1 = CITIES;
                    _a.label = 8;
                case 8:
                    if (!(_i < CITIES_1.length)) return [3 /*break*/, 39];
                    city = CITIES_1[_i];
                    console.log("\uD83D\uDD0D Searching pet services in: ".concat(city));
                    nowInVN = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
                    if (nowInVN.getHours() >= 10) {
                        console.log("⏰ Time limit reached (>= 10:00 AM Asia/Ho_Chi_Minh). Stopping execution...");
                        return [3 /*break*/, 39];
                    }
                    searchUrl = "https://www.google.com/maps/search/pet+services+".concat(encodeURIComponent(city));
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 37, , 38]);
                    return [4 /*yield*/, page.goto(searchUrl, { waitUntil: "networkidle", timeout: 45000 })];
                case 10:
                    _a.sent();
                    return [4 /*yield*/, sleep(3000, 5000)];
                case 11:
                    _a.sent();
                    listPanelSelector = "div[role='feed']";
                    // Wait for list panel to load
                    return [4 /*yield*/, page.waitForSelector(listPanelSelector, { timeout: 15000 }).catch(function () {
                            console.log("⚠️ Results feed panel not found (might be direct listing page or no results).");
                        })];
                case 12:
                    // Wait for list panel to load
                    _a.sent();
                    // Scroll to load all businesses in the list panel
                    console.log("📜 Scrolling result list to load all items...");
                    isEnd = false;
                    lastHeight = 0;
                    scrollAttempts = 0;
                    _a.label = 13;
                case 13:
                    if (!(!isEnd && scrollAttempts < 25)) return [3 /*break*/, 20];
                    return [4 /*yield*/, page.$(listPanelSelector)];
                case 14:
                    panelHandle = _a.sent();
                    if (!panelHandle)
                        return [3 /*break*/, 20];
                    // Scroll down by executing scrollTop modifications on feed panel element
                    return [4 /*yield*/, page.evaluate(function (selector) {
                            var el = document.querySelector(selector);
                            if (el) {
                                el.scrollTop = el.scrollHeight;
                            }
                        }, listPanelSelector)];
                case 15:
                    // Scroll down by executing scrollTop modifications on feed panel element
                    _a.sent();
                    return [4 /*yield*/, sleep(1500, 2500)];
                case 16:
                    _a.sent();
                    return [4 /*yield*/, page.evaluate(function (selector) {
                            var _a;
                            return ((_a = document.querySelector(selector)) === null || _a === void 0 ? void 0 : _a.scrollHeight) || 0;
                        }, listPanelSelector)];
                case 17:
                    newHeight = _a.sent();
                    if (!(newHeight === lastHeight)) return [3 /*break*/, 19];
                    return [4 /*yield*/, page.evaluate(function (selector) {
                            var _a;
                            return ((_a = document.querySelector(selector)) === null || _a === void 0 ? void 0 : _a.textContent) || "";
                        }, listPanelSelector)];
                case 18:
                    textContent = _a.sent();
                    if (textContent.includes("cuối danh sách") || textContent.includes("end of the list")) {
                        isEnd = true;
                    }
                    _a.label = 19;
                case 19:
                    lastHeight = newHeight;
                    scrollAttempts++;
                    return [3 /*break*/, 13];
                case 20:
                    listingSelector = "a[href*='/maps/place/']";
                    return [4 /*yield*/, page.$$(listingSelector)];
                case 21:
                    listingHandles = _a.sent();
                    console.log("\uD83D\uDCC8 Loaded ".concat(listingHandles.length, " listings to scrape."));
                    i = 0;
                    _a.label = 22;
                case 22:
                    if (!(i < Math.min(listingHandles.length, 50))) return [3 /*break*/, 36];
                    currentVNTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
                    if (currentVNTime.getHours() >= 10) {
                        console.log("⏰ Time limit reached (>= 10:00 AM Asia/Ho_Chi_Minh). Exiting processing loop...");
                        return [3 /*break*/, 36];
                    }
                    _a.label = 23;
                case 23:
                    _a.trys.push([23, 34, , 35]);
                    return [4 /*yield*/, page.$$(listingSelector)];
                case 24:
                    elements = _a.sent();
                    currentItem = elements[i];
                    if (!currentItem)
                        return [3 /*break*/, 35];
                    // Click listing item to open details card panel
                    return [4 /*yield*/, currentItem.click()];
                case 25:
                    // Click listing item to open details card panel
                    _a.sent();
                    return [4 /*yield*/, sleep(2500, 4500)];
                case 26:
                    _a.sent(); // Wait for details card animation/network calls
                    return [4 /*yield*/, page.evaluate(function () {
                            var _a, _b, _c;
                            // Extract Name from H1 tag inside details panel
                            var nameEl = document.querySelector("h1");
                            var name = ((_a = nameEl === null || nameEl === void 0 ? void 0 : nameEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                            // Extract Address by looking for item ID attribute
                            var addressEl = document.querySelector("[data-item-id='address']");
                            var address = ((_b = addressEl === null || addressEl === void 0 ? void 0 : addressEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "";
                            // Extract Phone number by searching for phone attribute
                            var phoneEl = document.querySelector("[data-item-id^='phone:tel:']");
                            var phoneRaw = (phoneEl === null || phoneEl === void 0 ? void 0 : phoneEl.getAttribute("data-item-id")) || "";
                            var phone = phoneRaw.replace("phone:tel:", "").trim();
                            // Extract working hours
                            var hoursEl = document.querySelector("[data-item-id='oh']");
                            var workingHours = ((_c = hoursEl === null || hoursEl === void 0 ? void 0 : hoursEl.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || "08:00 - 22:00";
                            return {
                                name: name,
                                address: address,
                                phone: phone,
                                workingHours: workingHours
                            };
                        })];
                case 27:
                    detailData = _a.sent();
                    currentUrl = page.url();
                    coordinates = null;
                    geoRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
                    match = currentUrl.match(geoRegex);
                    if (match) {
                        coordinates = {
                            lat: parseFloat(match[1]),
                            lng: parseFloat(match[2])
                        };
                    }
                    if (!detailData.name) return [3 /*break*/, 29];
                    payload = {
                        name: detailData.name,
                        address: detailData.address,
                        phone: detailData.phone || null,
                        workingHours: detailData.workingHours,
                        coordinates: coordinates,
                        city: city,
                        sourceUrl: currentUrl,
                        lastCrawledAt: new Date()
                    };
                    query = detailData.phone
                        ? { phone: detailData.phone }
                        : { name: detailData.name, address: detailData.address };
                    return [4 /*yield*/, collection.updateOne(query, { $set: payload }, { upsert: true })];
                case 28:
                    _a.sent();
                    console.log("\u2705 Upserted: \"".concat(detailData.name, "\" | Phone: ").concat(detailData.phone || "N/A"));
                    _a.label = 29;
                case 29: return [4 /*yield*/, page.$("button[aria-label='Đóng'], button[aria-label='Close']")];
                case 30:
                    closeBtn = _a.sent();
                    if (!closeBtn) return [3 /*break*/, 33];
                    return [4 /*yield*/, closeBtn.click()];
                case 31:
                    _a.sent();
                    return [4 /*yield*/, sleep(1000, 2000)];
                case 32:
                    _a.sent();
                    _a.label = 33;
                case 33: return [3 /*break*/, 35];
                case 34:
                    itemErr_1 = _a.sent();
                    console.error("\u274C Error parsing details for index ".concat(i, ":"), itemErr_1);
                    return [3 /*break*/, 35];
                case 35:
                    i++;
                    return [3 /*break*/, 22];
                case 36: return [3 /*break*/, 38];
                case 37:
                    cityErr_1 = _a.sent();
                    console.error("\u274C Error crawling search query for city ".concat(city, ":"), cityErr_1);
                    return [3 /*break*/, 38];
                case 38:
                    _i++;
                    return [3 /*break*/, 8];
                case 39: return [3 /*break*/, 43];
                case 40: return [4 /*yield*/, browser.close()];
                case 41:
                    _a.sent();
                    return [4 /*yield*/, client.close()];
                case 42:
                    _a.sent();
                    console.log("🏁 Google Maps Service Scraper Finished.");
                    return [7 /*endfinally*/];
                case 43: return [2 /*return*/];
            }
        });
    });
}
// Self execution check
if (require.main === module) {
    scrapeServices().catch(console.error);
}
