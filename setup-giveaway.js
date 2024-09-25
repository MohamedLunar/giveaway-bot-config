const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms');

function createGiveawayEmbed(giveawayName, endTime, numOfWinners, joinersCount = 0, leaversCount = 0) {
    const discordTimestamp = `<t:${Math.floor(endTime / 1000)}:R>`;
    return new EmbedBuilder()
        .setTitle(`🎉 **Giveaway**: ${giveawayName} 🎉`)
        .setDescription("click on the below button to enter")
        .addFields(
            { name: 'Ends In', value: discordTimestamp, inline: true },
            { name: 'Winners', value: numOfWinners.toString(), inline: true },
            { name: 'Joiners', value: joinersCount.toString(), inline: true },
            { name: 'Leavers', value: leaversCount.toString(), inline: true }
        )
.setColor('#361d57')
        .setThumbnail("https://media.discordapp.net/attachments/1227654023859929258/1283917980391968808/mid-logo.webp?ex=66e4bd4c&is=66e36bcc&hm=e6aa30c4371b4df27321546c89fb5e295e215a50ddf0cb343ff36907c7e72760&=&format=webp&width=317&height=317")
        .setFooter({ text: 'Hurry up! The clock is ticking.' })
        .setTimestamp(new Date(endTime));
}

async function handleGiveawayError(interaction, error) {
    console.error('Error handling the giveaway:', error);
    await interaction.reply({
        content: 'An error occurred while processing the giveaway. Please try again later or contact support.',
        ephemeral: true
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-giveaway')
        .setDescription('create a new giveaway')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('The duration of the giveaway (e.g., 1m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the giveaway')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('The number of winners')
                .setRequired(true)),

    async execute(interaction) {
        try {
            const time = interaction.options.getString('time');
            const name = interaction.options.getString('name');
            const winners = interaction.options.getInteger('winners');

            const durationMs = ms(time);
            if (!durationMs) {
                return interaction.reply({
                    content: 'Invalid time format provided. Please use formats like 1m, 1h, 1d.',
                    ephemeral: true
                });
            }

            const endTime = Date.now() + durationMs;

            const embed = createGiveawayEmbed(name, endTime, winners);
            const joinButton = new ButtonBuilder()
                .setCustomId('join_giveaway')
                .setLabel('Join Giveaway!')
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Success);

            const leaveButton = new ButtonBuilder()
                .setCustomId('leave_giveaway')
                .setLabel('Leave Giveaway')
                .setEmoji('🟥')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);
            const giveawayMessage = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
            if (!giveawayMessage) return;

            const joiners = new Set();
            const leavers = new Set();
            const filter = i => (i.customId === 'join_giveaway' || i.customId === 'leave_giveaway') && !i.user.bot;

            const collector = giveawayMessage.createMessageComponentCollector({ filter, time: durationMs });

            collector.on('collect', async i => {
                const userId = i.user.id;

                if (i.customId === 'join_giveaway') {
                    if (joiners.has(userId)) {
                        await i.reply({
                            content: 'You have already joined the giveaway.',
                            ephemeral: true
                        });
                        return;
                    }
                    if (leavers.has(userId)) {
                        leavers.delete(userId);
                    }
                    joiners.add(userId);
                } else if (i.customId === 'leave_giveaway') {
                    if (joiners.has(userId)) {
                        joiners.delete(userId);
                        leavers.add(userId);
                    } else {
                        await i.reply({
                            content: 'You are not currently joined in the giveaway, so you cannot leave.',
                            ephemeral: true
                        });
                        return;
                    }
                }

                try {
                    const updatedEmbed = createGiveawayEmbed(name, endTime, winners, joiners.size, leavers.size);
                    await i.update({ embeds: [updatedEmbed] });
                } catch (error) {
                    console.error('Failed to update giveaway message:', error);
                    handleGiveawayError(interaction, error);
                    collector.stop();
                }
            });

            // Send reminder 5 minutes before the giveaway ends
            const reminderTime = durationMs - (5 * 60 * 1000); // 5 minutes before end
            if (reminderTime > 0) {
                setTimeout(async () => {
                    try {
                        const channel = interaction.channel;
                        await channel.send({
                            content: `📢 **Reminder:** The giveaway "${name}" is ending in 5 minutes! <@everyone>`
                        });
                    } catch (error) {
                        console.error('Failed to send reminder message:', error);
                    }
                }, reminderTime);
            }

            collector.on('end', async () => {
                try {
                    const winnersArray = Array.from(joiners).sort(() => 0.5 - Math.random()).slice(0, winners);
                    const endedEmbed = new EmbedBuilder()
                        .setTitle(`🎉 Giveaway Ended: ${name} 🎉`)
                        .setDescription(`**Winner(s):** ${winnersArray.length > 0 ? winnersArray.map(id => `<@${id}>`).join(', ') : 'No winners'}`)
                        .addFields(
                            { name: 'Winners', value: winnersArray.length > 0 ? winnersArray.map(id => `<@${id}>`).join(', ') : 'No winners', inline: true },
                            { name: 'Total Participants', value: `${joiners.size}`, inline: true },
                            { name: 'Total Leavers', value: `${leavers.size}`, inline: true }
                        )
.setColor('#361d57')
                    .setFooter({ text: 'Thank you for participating!' });

                    await giveawayMessage.edit({ embeds: [endedEmbed], components: [] });
                } catch (error) {
                    console.error('Failed to conclude giveaway properly:', error);
                    handleGiveawayError(interaction, error);
                }
            });
        } catch (error) {
            console.error('An unexpected error occurred during the giveaway setup:', error);
            handleGiveawayError(interaction, error);
        }
    },
};
