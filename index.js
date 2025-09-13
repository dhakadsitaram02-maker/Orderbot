const { Client, GatewayIntentBits, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const config = require("./config.json");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.commands = new Collection();

// Register Slash Command in memory
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Slash Command
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "order") {
      const staffRoles = process.env.STAFF_ROLE_IDS.split(",").map(r => r.trim());
      const isStaff = interaction.member.roles.cache.some(r => staffRoles.includes(r.id)) || interaction.member.id === interaction.guild.ownerId;

      if (!isStaff) {
        await interaction.reply({ content: "❌ Only staff can start an order!", ephemeral: true });
        return;
      }

      // Start order
      const items = config.items;
      let index = 0;
      let cart = [];

      const sendNextItem = async () => {
        if (index >= items.length) {
          // All items done -> show total
          let totalUsd = cart.reduce((acc, i) => acc + i.usd, 0);
          let totalInr = cart.reduce((acc, i) => acc + i.inr, 0);

          const embed = new EmbedBuilder()
            .setTitle("🛒 Order Summary")
            .setDescription(cart.map(i => `• ${i.name} - $${i.usd} (₹${i.inr})`).join("\n") || "No items selected")
            .addFields({ name: "Total", value: `$${totalUsd} (₹${totalInr})` })
            .setColor("Green");

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm").setLabel("✅ Confirm Order").setStyle(ButtonStyle.Success)
          );

          await interaction.followUp({ embeds: [embed], components: [row] });
          return;
        }

        const item = items[index];
        const embed = new EmbedBuilder()
          .setTitle("📦 Order Items")
          .setDescription(`${item.name}\nPrice: $${item.usd} (₹${item.inr})`)
          .setColor("Blue");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("add").setLabel("Add to Cart").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("skip").setLabel("Skip").setStyle(ButtonStyle.Secondary)
        );

        await interaction.followUp({ embeds: [embed], components: [row] });
      };

      await interaction.reply({ content: "🛒 Starting order process...", ephemeral: true });
      sendNextItem();

      const filter = (i) => i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 600000 });

      collector.on("collect", async (i) => {
        if (i.customId === "add") {
          cart.push(config.items[index]);
          await i.reply({ content: `✅ Added ${config.items[index].name}`, ephemeral: true });
          index++;
          sendNextItem();
        } else if (i.customId === "skip") {
          await i.reply({ content: `⏭️ Skipped ${config.items[index].name}`, ephemeral: true });
          index++;
          sendNextItem();
        } else if (i.customId === "confirm") {
          let totalUsd = cart.reduce((acc, x) => acc + x.usd, 0);
          let totalInr = cart.reduce((acc, x) => acc + x.inr, 0);

          const logsChannel = interaction.guild.channels.cache.get(process.env.ORDER_LOGS_CHANNEL);
          if (logsChannel) {
            logsChannel.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle("📦 New Order")
                  .setDescription(cart.map(i => `• ${i.name} - $${i.usd} (₹${i.inr})`).join("\n"))
                  .addFields(
                    { name: "Total", value: `$${totalUsd} (₹${totalInr})` },
                    { name: "Customer", value: `<@${interaction.user.id}>` }
                  )
                  .setColor("Purple")
              ]
            });
          }

          await i.reply({ content: "✅ Order confirmed & sent to logs!", ephemeral: true });
          collector.stop();
        }
      });
    }
  }
});

client.login(process.env.TOKEN);
