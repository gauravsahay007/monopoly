<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="rules-container">
    <div class="rules-header">
      <button @click="router.push('/')" class="back-btn">← Back to Home</button>
      <h1>🎲 Monopoly Game Rules</h1>
      <p class="subtitle">Learn how to play and dominate the board!</p>
    </div>

    <div class="rules-content">
      <!-- Basic Rules -->
      <section class="rule-section">
        <h2>📜 Basic Rules</h2>
        <div class="rule-item">
          <h3>🎯 Objective</h3>
          <p>Be the last player standing with money! Buy properties, collect rent, and bankrupt your opponents to win.</p>
        </div>

        <div class="rule-item">
          <h3>🎲 Taking Turns</h3>
          <ul>
            <li>Roll two dice on your turn</li>
            <li>Move your token forward by the total shown</li>
            <li>Follow the instructions for the space you land on</li>
            <li>If you roll doubles, you get another turn (max 3 times)</li>
            <li>Rolling 3 consecutive doubles sends you to Jail!</li>
          </ul>
        </div>

        <div class="rule-item">
          <h3>🏠 Buying Properties</h3>
          <ul>
            <li>Land on an unowned property to buy it at the listed price</li>
            <li>If you don't buy, it goes to auction (optional rule)</li>
            <li>Collect rent when other players land on your properties</li>
            <li>Owning all properties in a color group gives you a monopoly!</li>
          </ul>
        </div>
      </section>

      <!-- Special Spaces -->
      <section class="rule-section">
        <h2>🎯 Special Spaces</h2>
        
        <div class="rule-item">
          <h3>🎁 Treasure & Surprise Cards</h3>
          <p>Draw a card and follow the instructions. Cards can give you money, take money away, or even send you to jail!</p>
        </div>

        <div class="rule-item">
          <h3>💰 Pass GO</h3>
          <p>Collect your salary every time you pass or land on GO!</p>
          <ul>
            <li>Classic World: $200</li>
            <li>India/Bangalore: ₹2,00,000 (2 Lakh)</li>
          </ul>
        </div>

        <div class="rule-item">
          <h3>🏖️ Vacation / Free Parking</h3>
          <p>Landing here collects all accumulated tax money! All fines and taxes go into this pot.</p>
        </div>

        <div class="rule-item">
          <h3>💸 Tax Spaces</h3>
          <ul>
            <li><strong>Income Tax:</strong> Pay the listed amount</li>
            <li><strong>Luxury Tax:</strong> Pay the listed amount</li>
            <li>All tax money goes to the Vacation pot</li>
          </ul>
        </div>
      </section>

      <!-- Jail Rules -->
      <section class="rule-section">
        <h2>🔒 Jail / Court Rules</h2>
        
        <div class="rule-item">
          <h3>Getting Sent to Jail</h3>
          <ul>
            <li>Land on "Go to Prison/Court" space</li>
            <li>Draw a "Go to Jail" card</li>
            <li>Roll doubles 3 times in a row</li>
          </ul>
        </div>

        <div class="rule-item">
          <h3>Getting Out of Jail</h3>
          <ul>
            <li><strong>Roll Doubles:</strong> You get 3 attempts. If you succeed, move immediately</li>
            <li><strong>Pay Fine:</strong> Pay ₹5 Lakh (India) or $50 (World) and roll to move</li>
            <li><strong>Failed 3 Times:</strong> Automatically pay the fine and move</li>
          </ul>
          <p class="note">⚠️ While in jail, you CANNOT collect rent from other players (optional rule)</p>
        </div>
      </section>

      <!-- Trading & Strategy -->
      <section class="rule-section">
        <h2>🤝 Trading & Strategy</h2>
        
        <div class="rule-item">
          <h3>Making Trades</h3>
          <ul>
            <li>Trade properties and cash with other players on your turn</li>
            <li>Both players must agree to the trade</li>
            <li>You can only trade properties you own (not mortgaged)</li>
            <li>No "IOUs" - all trades must be settled immediately</li>
          </ul>
        </div>

        <div class="rule-item">
          <h3>Property Values</h3>
          <p>When trading, remember:</p>
          <ul>
            <li>Properties in a monopoly group are more valuable</li>
            <li>Corner properties and high-traffic areas command higher prices</li>
            <li>Airports and Utilities scale with how many you own</li>
          </ul>
        </div>
      </section>

      <!-- Bankruptcy & Debt Settlement -->
      <section class="rule-section important">
        <h2>⚠️ Debt Settlement & Bankruptcy</h2>
        
        <div class="rule-item">
          <h3>🔴 Negative Balance Rule</h3>
          <p class="highlight">If your cash becomes negative, you MUST take action before ending your turn:</p>
          <ul>
            <li><strong>Option 1:</strong> Sell properties to other players via trades</li>
            <li><strong>Option 2:</strong> Mortgage properties to the bank (coming soon)</li>
            <li><strong>Option 3:</strong> Declare bankruptcy if you cannot pay</li>
          </ul>
          <p class="note">⛔ You CANNOT end your turn with negative cash!</p>
        </div>

        <div class="rule-item">
          <h3>Declaring Bankruptcy</h3>
          <ul>
            <li>If you owe money to another player and cannot pay, you're bankrupt</li>
            <li>All your properties go back to the bank</li>
            <li>You're eliminated from the game</li>
            <li>The last player remaining wins!</li>
          </ul>
        </div>
      </section>

      <!-- Special Property Rules -->
      <section class="rule-section">
        <h2>✈️ Special Property Types</h2>
        
        <div class="rule-item">
          <h3>Airports</h3>
          <p>Rent doubles for each additional airport you own:</p>
          <ul>
            <li>1 Airport: Base rent (₹1L or $25)</li>
            <li>2 Airports: 2× Base rent</li>
            <li>3 Airports: 4× Base rent</li>
            <li>4 Airports: 8× Base rent</li>
          </ul>
        </div>

        <div class="rule-item">
          <h3>Utilities (Water/Electric)</h3>
          <p>Rent is based on dice roll:</p>
          <ul>
            <li>1 Utility: Dice total × 4</li>
            <li>2 Utilities: Dice total × 10</li>
            <li>3 Utilities: Dice total × 20 (monopoly bonus)</li>
          </ul>
        </div>
      </section>

      <!-- Currency Scales -->
      <section class="rule-section">
        <h2>💱 Currency & Map Differences</h2>
        
        <div class="rule-item">
          <h3>Map Selection</h3>
          <div class="map-info">
            <div class="map-card">
              <h4>🌍 Classic World</h4>
              <ul>
                <li>Currency: US Dollars ($)</li>
                <li>Starting Cash: $1,500</li>
                <li>Pass GO: $200</li>
                <li>Property prices: $60-$400</li>
              </ul>
            </div>
            
            <div class="map-card">
              <h4>🇮🇳 India Edition</h4>
              <ul>
                <li>Currency: Indian Rupees (₹)</li>
                <li>Starting Cash: ₹1.5 Crore</li>
                <li>Pass GO: ₹2 Lakh</li>
                <li>Property prices: ₹60L-₹4Cr</li>
              </ul>
            </div>

            <div class="map-card">
              <h4>🏙️ Bangalore Edition</h4>
              <ul>
                <li>Currency: Indian Rupees (₹)</li>
                <li>Starting Cash: ₹1.5 Crore</li>
                <li>Features local landmarks</li>
                <li>Tech hub themed properties</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="rule-item">
          <h3>💰 Currency Shortcuts</h3>
          <p>When entering amounts during trades, use these shortcuts:</p>
          <ul>
            <li><strong>K</strong> = Thousand (1K = 1,000)</li>
            <li><strong>L</strong> = Lakh (1L = 1,00,000)</li>
            <li><strong>Cr</strong> = Crore (1Cr = 1,00,00,000)</li>
          </ul>
          <p class="example">Example: Type "8" and click "L" to make it ₹8,00,000 (8 Lakh)</p>
        </div>
      </section>

      <!-- Tips & Strategy -->
      <section class="rule-section">
        <h2>💡 Tips & Strategy</h2>
        
        <div class="rule-item">
          <h3>Winning Strategies</h3>
          <ul>
            <li>🎯 <strong>Focus on Monopolies:</strong> Owning all properties in a color group significantly increases rent</li>
            <li>💼 <strong>Trade Smart:</strong> Sometimes giving up a property helps you complete a monopoly</li>
            <li>💰 <strong>Cash Management:</strong> Always keep some cash reserve for rent and emergencies</li>
            <li>✈️ <strong>Airports Are Gold:</strong> Collect all 4 for exponential rent growth</li>
            <li>🏠 <strong>Build Houses:</strong> (Coming soon) Increase rent on monopolies</li>
            <li>⚡ <strong>Timing Matters:</strong> Know when to hold and when to trade</li>
          </ul>
        </div>
      </section>

      <!-- Back Button -->
      <div class="footer-actions">
        <button @click="router.push('/')" class="btn-home">🏠 Return to Home</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1b26 0%, #24283b 100%);
  color: white;
  padding: 2rem;
  overflow-y: auto;
}

.rules-header {
  max-width: 900px;
  margin: 0 auto 3rem;
  text-align: center;
}

.back-btn {
  background: rgba(255,255,255,0.1);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 1rem;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255,255,255,0.2);
}

.rules-header h1 {
  font-size: 2.5rem;
  margin: 1rem 0;
  background: linear-gradient(to right, #6366f1, #ec4899);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: #94a3b8;
  font-size: 1.1rem;
}

.rules-content {
  max-width: 900px;
  margin: 0 auto;
}

.rule-section {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.rule-section.important {
  border: 2px solid #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.rule-section h2 {
  color: #6366f1;
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 1.8rem;
}

.rule-item {
  margin-bottom: 2rem;
}

.rule-item:last-child {
  margin-bottom: 0;
}

.rule-item h3 {
  color: #cbd5e1;
  margin-bottom: 0.5rem;
  font-size: 1.3rem;
}

.rule-item p {
  color: #94a3b8;
  line-height: 1.6;
  margin: 0.5rem 0;
}

.rule-item ul {
  color: #94a3b8;
  line-height: 1.8;
  margin: 0.5rem 0;
  padding-left: 1.5rem;
}

.rule-item li {
  margin-bottom: 0.5rem;
}

.rule-item strong {
  color: #cbd5e1;
}

.note {
  background: rgba(59, 130, 246, 0.1);
  border-left: 4px solid #3b82f6;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  border-radius: 4px;
  color: #93c5fd !important;
}

.highlight {
  background: rgba(239, 68, 68, 0.1);
  border-left: 4px solid #ef4444;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  border-radius: 4px;
  color: #fca5a5 !important;
  font-weight: 600;
}

.example {
  background: rgba(34, 197, 94, 0.1);
  border-left: 4px solid #22c55e;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  border-radius: 4px;
  color: #86efac !important;
  font-style: italic;
}

.map-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.map-card {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 12px;
  padding: 1.5rem;
}

.map-card h4 {
  color: #a5b4fc;
  margin: 0 0 1rem;
  font-size: 1.2rem;
}

.map-card ul {
  margin: 0;
  padding-left: 1.2rem;
}

.footer-actions {
  text-align: center;
  margin: 3rem 0;
}

.btn-home {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  padding: 14px 32px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-home:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
}

@media (max-width: 768px) {
  .rules-container {
    padding: 1rem;
  }

  .rules-header h1 {
    font-size: 2rem;
  }

  .rule-section {
    padding: 1.5rem;
  }

  .map-info {
    grid-template-columns: 1fr;
  }
}
</style>
