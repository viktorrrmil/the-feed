# The Feed

**The Feed** is a browser-based scrolling RPG about surviving a corrupted social media feed through real-time combat and resource management.

Built for the **Nordeus Full Stack Challenge 2026**.

---

## Concept

You scroll through an endless feed of posts.

- Most posts are normal  
- Some are **anomalies**  
- Some are **evil posts** that pull you into combat  

> Survive as many posts as possible and defeat all enemies.
---

## Core Mechanics

### Feed Loop
- Scroll through posts
- Interact to regain **AT (Attention)**
- Detect anomalies (subtle, no reward)
- Encounter enemies through evil posts

### Combat System
- Simultaneous action resolution (player vs enemy)
- Actions:
  - Attack
  - Block
  - Parry
  - Exploits (special abilities)

- **AT (Attention)** is both:
  - Health
  - Resource

- Every decision is a trade:
  - Spend AT to act
  - Regain AT through successful plays

---

## Progression

- Defeat enemies to **steal their exploits**
- Equip up to **4 exploits** at a time
- Collect **items** that modify your stats and playstyle
- Adapt your build as the run progresses

---

## Enemies

The game features 5 unique enemies representing corrupted feed archetypes:

- The Course Seller  
- The Crypto Bro  
- The Reseller  
- The Clickbaiter  
- The Larp Philosopher  

Each enemy has:
- distinct behavior  
- unique abilities  
- a stealable exploit (except final boss)

---

## Objective

- **Lose:** AT reaches 0  
- **Win:** Defeat all enemies  
- **Score:** Number of posts survived  

---

## Tech Stack

**Frontend**
- React (Vite)
- CSS animations (no game engine)

**Backend**
- Go (Gin)
- WebSockets for real-time game state

---

## Technical Note

Built in the browser to focus on real-time systems, rapid iteration, and delivering a complete gameplay loop within the given timeframe.

---

## Running the Project

### Server
```bash
cd server
go run .
```

### Client
```bash
cd client
npm install
npm run dev
```
