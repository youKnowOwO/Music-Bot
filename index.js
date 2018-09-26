const { PREFIX, TOKEN, GOOGLE_KEY } = process.env;
const Eris = require('eris');
const YouTube = require('simple-youtube-api');
const ytdl = require('ytdl-core');

const client = new Eris(TOKEN);
const youtube = new YouTube(GOOGLE_KEY);
const queue = new Eris.Collection();

client.on('ready', () => console.log('Yo this ready'));

client.on('messageCreate', async msg => {
	if(!msg.channel.guild || msg.author.bot) return;
	if(!msg.content.startsWith(PREFIX)) return;
	const args = msg.content.slice(PREFIX.length).trim().split(/ +/g);
	const command = args.shift().toLowerCase();
	
	if(command === 'play'){
		const voiceChannel = msg.member.voiceState;
		if(!voiceChannel.channelID) return msg.channel.createMessage('❌ | You must in voice channel to play music');
		if(!args.length) return msg.channel.createMessage('❌ | No query provided');
		if (/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/.test(args[0])) {
			const playlist = await youtube.getPlaylist(args[0]);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				try{
					const vid = await youtube.getVideoByID(video.id);
					await handleVideo(vid, msg, voiceChannel, true);
				}catch(e) { continue }
			}
			return msg.channel.createMessage(`✅ | **${playlist.title}**: has been added to queue`);
		}
		try{
			const video = await youtube.getVideo(args[0]);
			return handleVideo(video, msg, voiceChannel);
		}catch(error){
			const videos = await youtube.searchVideos(args.join(' '), 1);
			if(!videos.length) return msg.channel.createMessage('❌ | No result found');
			const video = await youtube.getVideoByID(videos[0].id);
			return handleVideo(video, msg, voiceChannel);
		}
	}else if(command === 'skip'){
		const serverQueue = queue.get(msg.member.guild.id);
		if(!serverQueue) return msg.channel.createMessage('❌ | Im not playing anything right now');
		if(!msg.member.voiceState.channelID) return msg.channel.createMessage('❌ | You must join voice channel to skip song');
		msg.channel.createMessage('✅ | Song skipped');
		return client.voiceConnections.get(msg.member.guild.id).stopPlaying();
	}else if(command === 'stop'){
		const serverQueue = queue.get(msg.member.guild.id);
		if(!serverQueue) return msg.channel.createMessage('❌ | Im not playing anything right now');
		if(!msg.member.voiceState.channelID) return msg.channel.createMessage('❌ | You must join voice channel to stop queue');
		serverQueue.songs = [];
		msg.channel.createMessage('✅ | Stop current queue');
		return client.voiceConnections.get(msg.member.guild.id).stopPlaying();
	}else if(command === 'loop'){
		const serverQueue = queue.get(msg.member.guild.id);
		if(!serverQueue) return msg.channel.createMessage('❌ | Im not playing anything right now');
		if(!msg.member.voiceState.channelID) return msg.channel.createMessage('❌ | You must join voice channel to loop/unloop queue');
		serverQueue.loop = !serverQueue.loop;
		return msg.channel.createMessage(`✅ | ${serverQueue.loop ? 'loop' : 'unloop' } current queue`);
	}else if(command === 'np'){
		const serverQueue = queue.get(msg.member.guild.id);
		if(!serverQueue) return msg.channel.createMessage('❌ | Im not playing anything right now');
		return msg.channel.createMessage(`🎵 | Now playing **${serverQueue.songs[0].title}**`);
	}else if(command === 'queue'){
		const serverQueue = queue.get(msg.member.guild.id);
		if(!serverQueue) return msg.channel.createMessage('❌ | Im not playing anything right now');
		return msg.channel.createMessage(`🎶 | Now playing **${serverQueue.songs[0].title}**\n\n__**Song Queue**__: ${serverQueue.songs.map(x => `• ${x.title}`).join(' ')}`);
	}
});

async function handleVideo(video, msg, voiceChannel, hide = false){
	const serverQueue = queue.get(msg.channel.guild.id);
	const song = {
		id: video.id,
		title: video.title,
		url: `https://www.youtube.com/watch?v=${video.id}`
	}
	if(!serverQueue){
		let queueConstruct = {
			channel: msg.channel,
			voiceChannel: voiceChannel.channelID,
			songs: [song],
			loop: false,
			volume: 5,
			connection: null
		}
		const mess = await msg.channel.createMessage('⏱️| Joining Voice channel');
		queueConstruct.connection = await client.joinVoiceChannel(voiceChannel.channelID);
		await mess.delete();
		queue.set(msg.channel.guild.id, queueConstruct);
		return play(msg.channel.guild, queueConstruct.songs[0]);
	}
	serverQueue.songs.push(song);
	if(!hide) return msg.channel.createMessage(`✅ | **${song.title}** added to queue`);
}

function play(guild, song){
	const serverQueue = queue.get(guild.id);
	if(!song){
		queue.delete(guild.id);
		return client.leaveVoiceChannel(serverQueue.voiceChannel);
	}
	serverQueue.connection.play(ytdl(song.url, { filter: 'audioonly' }))
	serverQueue.connection.on('end', () => {
		const shiffed = serverQueue.songs.shift();
		if(serverQueue.loop) serverQueue.songs.push(shiffed);
		return play(guild, serverQueue.songs[0]);
	});
	serverQueue.channel.createMessage(`🎶 | Now playing **${song.title}**`);
}

client.connect();
