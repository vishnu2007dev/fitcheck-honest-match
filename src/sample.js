// Sample inputs and a sample model reply, clearly labeled as made up. Used for "Load sample" and "See a sample result".
export const SAMPLE_POSTING = `Northwind Labs (SAMPLE POSTING, fictional company)
Software Engineering Intern, Summer 2027
Phoenix, AZ (hybrid)

About the role
You will build internal tools that help our support team answer customers faster, working with Python services and a React dashboard.

Basic qualifications
- Currently pursuing a bachelor's degree in Computer Science or a related field, with an expected graduation date between December 2027 and June 2029.
- Experience programming in Python or Java.
- Understanding of data structures and algorithms.
- Experience using Git for version control.

Preferred qualifications
- Experience building web interfaces with React.
- Familiarity with SQL databases.
- Exposure to cloud services such as AWS.
- Experience writing unit tests.

Candidates must be authorized to work in the United States. We are unable to sponsor visas for this role.`;

export const SAMPLE_RESUME = `Alex Rivera (SAMPLE RESUME, fictional student)
Computer Science, B.S., Arizona State University, expected December 2028

Projects
StudyBuddy, a course planner web app (React, Node.js)
- Built a React front end that lets students plan their semester, used by 40 classmates
- Wrote a Node.js API with Express that stores plans in a PostgreSQL database
Campus Bot, a Discord bot (Python)
- Developed a Python bot that answers course questions for a 300-member Discord server

Experience
IT Help Desk Assistant, ASU Library (Aug 2026 to present)
- Troubleshoot laptop and network issues for students and staff

Coursework: Data Structures and Algorithms, Object-Oriented Programming in Java
Skills: Python, Java, JavaScript, React, SQL, Git`;

export const SAMPLE_PROFILE = { gradMonth: 'December', gradYear: '2028', year: 'Second year (sophomore)', authorization: 'US citizen or permanent resident', location: 'Phoenix, AZ' };

// What a model following the protocol might return. R6 contains a made-up receipt on purpose,
// so the demo shows the engine catching it.
export const SAMPLE_RAW = {
  role_title: 'Software Engineering Intern, Summer 2027',
  company: 'Northwind Labs (sample)',
  requirements: [
    { id: 'R1', text: 'Python or Java programming', posting_quote: 'Experience programming in Python or Java.', importance: 'required', category: 'technical_skill', level: 3, resume_quote: 'Developed a Python bot that answers course questions for a 300-member Discord server', note: 'A real Python project with a user count.', gap_action: null },
    { id: 'R2', text: 'Data structures and algorithms', posting_quote: 'Understanding of data structures and algorithms.', importance: 'required', category: 'education', level: 2, resume_quote: 'Coursework: Data Structures and Algorithms', note: 'Taken as a course, but no project shows it in use.', gap_action: null },
    { id: 'R3', text: 'Git version control', posting_quote: 'Experience using Git for version control.', importance: 'required', category: 'tool', level: 1, resume_quote: 'Skills: Python, Java, JavaScript, React, SQL, Git', note: 'Only listed in the skills line.', gap_action: 'If you used Git for StudyBuddy or Campus Bot, say so in one of those bullets and link the repository. If not, put your next project on GitHub with real commit history.' },
    { id: 'R4', text: 'React web interfaces', posting_quote: 'Experience building web interfaces with React.', importance: 'preferred', category: 'technical_skill', level: 3, resume_quote: 'Built a React front end that lets students plan their semester, used by 40 classmates', note: 'Built and used by real people.', gap_action: null },
    { id: 'R5', text: 'SQL databases', posting_quote: 'Familiarity with SQL databases.', importance: 'preferred', category: 'technical_skill', level: 2, resume_quote: 'Wrote a Node.js API with Express that stores plans in a PostgreSQL database', note: 'Used PostgreSQL in a project, no detail on queries or schema.', gap_action: null },
    { id: 'R6', text: 'Cloud services such as AWS', posting_quote: 'Exposure to cloud services such as AWS.', importance: 'preferred', category: 'tool', level: 2, resume_quote: 'Deployed the StudyBuddy API on AWS Lambda', note: 'Deployed a project to AWS.', gap_action: null },
    { id: 'R7', text: 'Unit testing', posting_quote: 'Experience writing unit tests.', importance: 'preferred', category: 'technical_skill', level: 0, resume_quote: null, note: 'No testing shown anywhere.', gap_action: 'Add a few unit tests to Campus Bot with pytest, then mention them in that bullet. In an interview, say you have not written tests at work yet and describe what you would test first.' },
    { id: 'R8', text: 'Helping non-technical users', posting_quote: 'help our support team answer customers faster', importance: 'implied', category: 'soft_skill', level: 2, resume_quote: 'Troubleshoot laptop and network issues for students and staff', note: 'Help desk work shows patience with non-technical users.', gap_action: null },
  ],
  gates: [
    { type: 'graduation_window', status: 'pass', posting_quote: 'with an expected graduation date between December 2027 and June 2029', candidate_fact: 'Expected graduation: December 2028', note: 'December 2028 is inside the window.' },
    { type: 'work_authorization', status: 'pass', posting_quote: 'Candidates must be authorized to work in the United States.', candidate_fact: 'US citizen or permanent resident', note: 'No sponsorship needed.' },
    { type: 'location', status: 'pass', posting_quote: 'Phoenix, AZ (hybrid)', candidate_fact: 'Prefers Phoenix, AZ', note: 'Same city.' },
  ],
  defend_questions: [
    { resume_quote: 'used by 40 classmates', question: 'How did you get 40 classmates to use StudyBuddy, and what did they ask you to change?' },
    { resume_quote: 'Developed a Python bot that answers course questions for a 300-member Discord server', question: 'How does the bot decide what answer to give, and what happens when it does not know?' },
    { resume_quote: 'stores plans in a PostgreSQL database', question: 'Walk me through your database tables. Why did you pick PostgreSQL?' },
  ],
  summary: 'Strong match on the core languages and on React, backed by real projects. The biggest gaps are testing and cloud experience, and Git is only listed, not shown.',
};
