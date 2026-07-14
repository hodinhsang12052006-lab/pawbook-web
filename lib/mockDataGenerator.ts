import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// Hashed once at module load and reused for every seed account — these are
// throwaway "filler" profiles for the swipe deck, not real logins, so paying
// bcrypt's cost per-generated-user would be wasted work.
const SEED_PASSWORD_HASH = bcrypt.hashSync("bitpaw-seed-account-not-loginable", 10);

const SEED_EMPLOYER_EMAIL = "seed.employer@bitpaw.internal";

const SKILL_POOL = [
  "Chăm sóc thú cưng", "Grooming", "Spa trị liệu", "Massage body", "Sửa khóa",
  "Điện lạnh", "Cơ khí ô tô", "React", "Node.js", "Thiết kế đồ họa",
  "Chốt sale", "Chăm sóc khách hàng", "Kế toán", "Vận chuyển", "Giao hàng nhanh",
];

const JOB_TITLE_POOL = [
  "Nhân viên Spa thú cưng", "Kỹ thuật viên sửa khóa", "Thợ điện lạnh",
  "Nhân viên Grooming", "Chuyên viên chăm sóc khách hàng", "Tài xế giao hàng",
  "Nhân viên bán hàng", "Kỹ thuật viên ô tô", "Lập trình viên Fullstack",
];

// Deterministic small offset around a center point — purely for Map Mode
// visualization. NOT real geocoded addresses; seeded users/static fixtures
// have no true coordinates, so this is an honest approximation, not GPS data.
export function jitterCoords(centerLat: number, centerLng: number, seedIndex: number): [number, number] {
  const angle = (seedIndex * 47) % 360;
  const radiusKm = 0.5 + (seedIndex % 9) * 0.6;
  const rad = (angle * Math.PI) / 180;
  const dLat = (radiusKm / 111) * Math.cos(rad);
  const dLng = (radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180))) * Math.sin(rad);
  return [centerLat + dLat, centerLng + dLng];
}

async function getOrCreateSeedEmployer() {
  const existing = await prisma.user.findUnique({ where: { email: SEED_EMPLOYER_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      name: "BitPaw AI Đối Tác Tuyển Dụng",
      email: SEED_EMPLOYER_EMAIL,
      password: SEED_PASSWORD_HASH,
      role: "EMPLOYER",
      avatarUrl: `https://ui-avatars.com/api/?name=BitPaw&background=6366f1&color=ffffff&bold=true`,
      bio: "Tài khoản đối tác hệ thống — tự động đăng tin khi dữ liệu thực tế cạn kiệt.",
    },
  });
}

// Tops up the candidate pool with real, persisted Users (role USER) when the
// combined real+static deck is running low — so a "match" on one of these
// can still create a genuine Application row, instead of being a dead-end
// mock that can never flow into the HR dashboard.
export async function generateFakeCandidates(count: number) {
  const created = [];
  for (let i = 0; i < count; i++) {
    const name = faker.person.fullName();
    const skills = faker.helpers.arrayElements(SKILL_POOL, { min: 2, max: 4 });
    try {
      const user = await prisma.user.create({
        data: {
          name,
          email: faker.internet.email({ firstName: name.split(" ")[0], provider: "bitpaw-demo.internal" }).toLowerCase(),
          password: SEED_PASSWORD_HASH,
          role: "USER",
          avatarUrl: faker.image.avatarGitHub(),
          bio: faker.person.bio(),
          skills: skills.join(", "),
          address: faker.location.streetAddress({ useFullAddress: false }) + ", TP. Hồ Chí Minh",
        },
      });
      created.push(user);
    } catch {
      // Extremely unlikely email collision — just skip this one, the caller
      // doesn't depend on getting exactly `count` back.
    }
  }
  return created;
}

// Same idea for the jobs deck: real Jobs owned by a dedicated seed employer
// account, so applying to one is a genuine Application, not a dead end.
export async function generateFakeJobs(count: number) {
  const employer = await getOrCreateSeedEmployer();
  const created = [];
  for (let i = 0; i < count; i++) {
    const title = faker.helpers.arrayElement(JOB_TITLE_POOL);
    try {
      const job = await prisma.job.create({
        data: {
          title,
          description: faker.lorem.sentences(2),
          salary: `${faker.number.int({ min: 8, max: 25 })}.000.000đ - ${faker.number.int({ min: 26, max: 40 })}.000.000đ`,
          companyName: faker.company.name(),
          employerId: employer.id,
          workType: faker.helpers.arrayElement(["Toàn thời gian", "Bán thời gian", "Freelance"]),
          niche: faker.helpers.arrayElement(["IT", "MMO", "SPA", "MECHANIC", "FNB", "OTHERS"]) as any,
        },
      });
      created.push(job);
    } catch {
      // Skip on unexpected write failure — non-critical filler data.
    }
  }
  return created;
}
