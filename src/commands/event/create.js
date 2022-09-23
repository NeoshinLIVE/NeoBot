const { inlineCode } = require('@discordjs/builders');
const { Events } = require('../../database');

function createDateTime(date, time) {
    const d = date.split('.');
    const dateString = `${d[1]}.${d[0]}.${d[2]} ${time}`;

    return new Date(dateString);
}

function getEventData(data) {
    if (!data || !data.interaction) return;

    const { options } = data.interaction;
    const banner = options.getAttachment('banner');
    const event = {
        name: options.getString('name'),
        price: options.getString('price'),
        format: options.getString('format'),
        description: options.getString('description'),
        banner_url: banner ? banner.url : '',
        start_date: createDateTime(options.getString('start_date'), options.getString('start_time')),
        max_teams: options.getInteger('max_teams'),
    };

    return event;
}

async function checkEvent(data) {
    if (!data || !data.interaction) return;

    data.event = getEventData(data);
    const nameTaken = await Events.findOne({ where: { name: data.event.name } }).catch(() => { return false; });
    const currentDate = new Date();
    const eventDate = new Date(data.event.start_date);

    if (nameTaken) {
        await data.interaction.editReply(`:no_entry: Es existiert bereits ein Event mit dem Namen **${data.event.name}**. Bitte wähle einen anderen Namen.`);
        return;
    }

    if (currentDate > eventDate) {
        await data.interaction.editReply(':no_entry: Das Datum liegt in der Vergangenheit, bitte wähle ein Datum in der Zukunft.');
        return;
    }

    return data;
}

async function createEvent(data) {
    if (!data || !data.interaction || !data.event) return;

    return await Events.create(data.event).then(event => {
        data.event = event;
        return data;
    });
}

async function sendReponse(data) {
    if (!data || !data.interaction || !data.event) return;

    await data.interaction.editReply(`:white_check_mark: Das Event **${data.event.name}** wurde erstellt, ist aber noch nicht öffentlich.\nUm das event zu veröffentlichen nutze den ${inlineCode('/event publish')} Befehl.`);
    return;
}

module.exports = async function(interaction) {
    await interaction.deferReply({ ephemeral: true });

    checkEvent({ interaction })
        .then(data => createEvent(data))
        .then(data => sendReponse(data))
        .catch(async error => {
            console.log(error);
            await interaction.editReply(':no_entry: Es gab ein Problem bei der Ausführung des Befehls. Bitte wende dich an einen Admin.');
            return;
        });
};