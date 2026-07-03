/**
 * Calculates a match score (0-100) between a candidate's skills and a job's AI tags.
 * Supports comma/space delimiters, casing sanitization, and keyword substring matching.
 */
export function calculateMatchScore(userSkillsStr: string | null, jobTagsStr: string | null): number {
  if (!userSkillsStr || !jobTagsStr) return 0;

  // Split and sanitize user skills
  const userSkills = userSkillsStr
    .toLowerCase()
    .split(/[,\s/]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Split and sanitize job tags
  const jobTags = jobTagsStr
    .toLowerCase()
    .split(/[,\s/]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (userSkills.length === 0 || jobTags.length === 0) return 0;

  let matches = 0;
  jobTags.forEach(tag => {
    // True if job tag is part of user skill, or user skill is part of job tag
    const isMatched = userSkills.some(skill => 
      skill.includes(tag) || tag.includes(skill)
    );
    if (isMatched) {
      matches++;
    }
  });

  const scorePercent = Math.round((matches / jobTags.length) * 100);
  return Math.min(100, Math.max(0, scorePercent));
}
