import { z } from 'zod';
import { getAIResponse } from '../ai';

export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  content: z.string(),
  quiz: z.array(z.object({
    id: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.number(),
    explanation: z.string()
  }))
});

export type Lesson = z.infer<typeof LessonSchema>;

export const lessons: Lesson[] = [
  {
    id: 'blockchain-basics',
    title: 'Blockchain Fundamentals',
    description: 'Learn the core concepts of blockchain technology',
    content: `
# Introduction to Blockchain Technology

Blockchain is a decentralized, distributed ledger that records transactions across a network of computers. Let's explore the key concepts:

## What is Blockchain?

A blockchain is a chain of blocks that contains information. The data which is stored inside a block depends on the type of blockchain. For example, Bitcoin blockchain stores the details about a transaction such as the sender, receiver, and number of coins.

## Key Components

1. **Blocks**
   - Contains valid transactions
   - Has a reference to the previous block
   - Contains a timestamp and other metadata

2. **Decentralization**
   - No central authority
   - Network is maintained by nodes
   - Consensus mechanisms ensure agreement

3. **Immutability**
   - Once data is recorded, it cannot be changed
   - Creates trust and transparency
   - Ensures data integrity

## How Does It Work?

1. Transaction is initiated
2. Transaction is broadcast to the network
3. Network of nodes validates the transaction
4. Transaction is combined with others to create a block
5. Block is added to the existing blockchain
6. Transaction is complete and permanent

## Real-World Applications

- Cryptocurrencies
- Smart Contracts
- Supply Chain Management
- Digital Identity
- Voting Systems
    `,
    quiz: [
      {
        id: 'q1',
        question: 'What is the main characteristic of blockchain technology?',
        options: [
          'Centralized control',
          'Decentralized and distributed ledger',
          'Single computer storage',
          'Temporary data storage'
        ],
        correctAnswer: 1,
        explanation: 'Blockchain is a decentralized and distributed ledger that operates across a network of computers, ensuring no single point of control.'
      },
      {
        id: 'q2',
        question: 'What makes blockchain data immutable?',
        options: [
          'Regular backups',
          'Central authority verification',
          'Cryptographic linking of blocks',
          'Data compression'
        ],
        correctAnswer: 2,
        explanation: 'Blockchain achieves immutability through cryptographic linking of blocks, making it extremely difficult to alter past records without detection.'
      },
      {
        id: 'q3',
        question: 'Which of the following is NOT a component of a block?',
        options: [
          'Transaction data',
          'Timestamp',
          'Previous block reference',
          'Future block prediction'
        ],
        correctAnswer: 3,
        explanation: 'Blocks contain transaction data, timestamps, and references to previous blocks, but cannot predict future blocks.'
      }
    ]
  },
  {
    id: 'smart-contracts',
    title: 'Smart Contracts',
    description: 'Understanding automated, self-executing contracts on the blockchain',
    content: `
# Smart Contracts Explained

Smart contracts are self-executing contracts with the terms directly written into code. They run on blockchain networks, automatically executing when predetermined conditions are met.

## What are Smart Contracts?

Smart contracts are programs stored on a blockchain that automatically execute when predetermined conditions are met. They typically are used to automate the execution of an agreement so that all participants can be immediately certain of the outcome, without any intermediary's involvement.

## Key Features

1. **Automation**
   - Self-executing based on conditions
   - No manual intervention needed
   - Reduces human error

2. **Transparency**
   - Code is visible on the blockchain
   - All parties can verify the terms
   - Creates trust through visibility

3. **Immutability**
   - Cannot be changed once deployed
   - Ensures contract integrity
   - Provides security for all parties

## Use Cases

1. **DeFi (Decentralized Finance)**
   - Lending and borrowing
   - Token swaps
   - Yield farming

2. **NFTs (Non-Fungible Tokens)**
   - Digital art sales
   - Gaming items
   - Digital collectibles

3. **Business Applications**
   - Supply chain management
   - Insurance claims
   - Automated payments
    `,
    quiz: [
      {
        id: 'q1',
        question: 'What is a smart contract?',
        options: [
          'A legal document',
          'A self-executing program on the blockchain',
          'A digital signature',
          'A cryptocurrency wallet'
        ],
        correctAnswer: 1,
        explanation: 'Smart contracts are self-executing programs stored on the blockchain that automatically execute when predetermined conditions are met.'
      },
      {
        id: 'q2',
        question: 'Which feature ensures that smart contract code cannot be modified after deployment?',
        options: [
          'Automation',
          'Transparency',
          'Immutability',
          'Scalability'
        ],
        correctAnswer: 2,
        explanation: 'Immutability is the feature that ensures smart contracts cannot be modified once they are deployed on the blockchain.'
      },
      {
        id: 'q3',
        question: 'Which is NOT a common use case for smart contracts?',
        options: [
          'DeFi applications',
          'NFT minting',
          'Physical contract signing',
          'Automated payments'
        ],
        correctAnswer: 2,
        explanation: 'Physical contract signing is not a use case for smart contracts as they are digital, self-executing programs on the blockchain.'
      }
    ]
  }
];

export async function generateLesson(topic: string): Promise<Lesson> {
  try {
    // Generate the lesson content
    const contentPrompt = `Create a comprehensive blockchain lesson about ${topic}. Include:
    1. A detailed explanation with sections and subsections
    2. Real-world examples and applications
    3. Key concepts and terminology
    4. Technical details where appropriate
    
    Format the content in markdown with proper headings, lists, and emphasis.
    
    Start with a # heading for the title, then use ## for main sections and ### for subsections.
    Use bullet points and numbered lists where appropriate.
    Include code examples if relevant.`;

    const content = await getAIResponse([
      { role: 'system', content: 'You are an expert blockchain educator. Create detailed, accurate, and engaging content.' },
      { role: 'user', content: contentPrompt }
    ], 'education');

    // Generate the quiz questions
    const quizPrompt = `Create 3 multiple-choice questions to test understanding of ${topic}. 
    Format your response exactly like this example:
    {
      "questions": [
        {
          "question": "What is the main purpose of blockchain?",
          "options": [
            "To store data centrally",
            "To create a decentralized ledger",
            "To speed up databases",
            "To reduce storage costs"
          ],
          "correctAnswer": 1,
          "explanation": "Blockchain's main purpose is to create a decentralized ledger that allows for trustless transactions and data storage."
        }
      ]
    }`;

    const quizResponse = await getAIResponse([
      { role: 'system', content: 'You are an expert at creating educational assessments. Generate clear, challenging questions that test understanding.' },
      { role: 'user', content: quizPrompt }
    ], 'education');

    let quiz;
    try {
      // Try to parse the quiz response as JSON
      const parsedQuiz = JSON.parse(quizResponse);
      quiz = parsedQuiz.questions.map((q: any, index: number) => ({
        id: `generated-${Date.now()}-${index}`,
        ...q
      }));
    } catch (parseError) {
      console.error('Failed to parse quiz JSON:', parseError);
      // Provide a default quiz if parsing fails
      quiz = [
        {
          id: `generated-${Date.now()}-0`,
          question: `What is the most important aspect of ${topic}?`,
          options: [
            'Option A',
            'Option B',
            'Option C',
            'Option D'
          ],
          correctAnswer: 0,
          explanation: 'This is a default question due to generation error.'
        }
      ];
    }

    // Create the lesson object
    const lesson: Lesson = {
      id: `generated-${Date.now()}`,
      title: `Understanding ${topic}`,
      description: `A comprehensive guide to ${topic} in blockchain technology`,
      content,
      quiz
    };

    // Validate the lesson object against the schema
    const validatedLesson = LessonSchema.parse(lesson);
    return validatedLesson;

  } catch (error) {
    console.error('Error generating lesson:', error);
    throw new Error('Failed to generate lesson content');
  }
}