/**********************************************************************
    Freeciv-web - the web version of Freeciv. http://play.freeciv.org/
    Copyright (C) 2009-2015  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

var nations = {};
var nation_groups = [];
var diplstates = {};
var selected_player = -1;


/**************************************************************************
 ...
**************************************************************************/
function update_nation_screen()
{
  var nation_list_html = "<table class='tablesorter' id='nation_table' width='95%' border=0 cellspacing=0 >"
	  + "<thead><tr><th>Flag</th><th>Color</th><th>Player Name:</th>"
	  + "<th>Nation:</th><th>Attitude</th><th>Score</th><th>AI/Human</th><th>Alive?</th>"
	  + "<th>Diplomatic state</th><th>Shared vision</th><th>Team</th><th>State</th></tr></thead><tbody>";

  /* Fetch online (connected) players on this game from Freeciv-proxy. */
  var online_players_html = "";
  $.ajax({
    url: "/civsocket/" + (parseInt(civserverport) + 1000) + "/status",
    dataType: "html",
    cache: false,
    async: false
  }).done(function( data ) {
    online_players_html = data;
  });

  for (var player_id in players) {
    var pplayer = players[player_id];
    if (pplayer['nation'] == -1) continue;
    if (is_longturn() && pplayer['name'].indexOf("New Available Player") != -1) continue;

    var flag_html = "<canvas id='nation_dlg_flags_" + player_id + "' width='29' height='20' class='nation_flags'></canvas>";

    var plr_class = "";
    if (!client_is_observer() && client.conn.playing != null && player_id == client.conn.playing['playerno']) plr_class = "nation_row_self";
    if (!pplayer['is_alive']) plr_class = "nation_row_dead";
    if (!client_is_observer() && diplstates[player_id] != null && diplstates[player_id] == DS_WAR) plr_class = "nation_row_war";

    nation_list_html += "<tr data-plrid='" + player_id + "' class='" + plr_class
	   + "'><td>" + flag_html + "</td>";
    nation_list_html += "<td><div style='background-color: " + nations[pplayer['nation']]['color']
           + "; margin: 5px; width: 25px; height: 25px;'>"
           + "</div></td>";

    nation_list_html += "<td>" + pplayer['name'] + "</td><td>"
           + nations[pplayer['nation']]['adjective']  + "</td><td>"
	   + col_love(pplayer) + "</td><td>"
	   + get_score_text(pplayer) + "</td><td>"
     + (pplayer['flags'].isSet(PLRF_AI) ?
          get_ai_level_text(pplayer) + " AI" : "Human") + "</td><td>"
	   + (pplayer['is_alive'] ? "Alive" : "Dead") +  "</td>";

    if (!client_is_observer() && client.conn.playing != null && diplstates[player_id] != null && player_id != client.conn.playing['playerno']) {
      nation_list_html += "<td>" + get_diplstate_text(diplstates[player_id]) + "</td>";
    } else {
      nation_list_html += "<td>-</td>";
    }

    nation_list_html += "<td>"
    if (!client_is_observer() && client.conn.playing != null) {
      if (pplayer['gives_shared_vision'].isSet(client.conn.playing['playerno']) && client.conn.playing['gives_shared_vision'].isSet(player_id)) {
        nation_list_html += "Both ways"
      } else if (pplayer['gives_shared_vision'].isSet(client.conn.playing['playerno'])) {
        nation_list_html += "To you"
      } else if (client.conn.playing['gives_shared_vision'].isSet(player_id)) {
        nation_list_html += "To them"
      } else {
        nation_list_html += "-"
      }
    }
    nation_list_html += "</td>"

    nation_list_html += "<td>Team " + pplayer['team'] + "</td>";
    var pstate = " ";
    if (online_players_html.toLowerCase().indexOf(pplayer['name'].toLowerCase()) != -1) {
      pstate = "<span style='color: #00FF00;'><b>Online</b></span>";
    } else if (pplayer['phase_done'] && !pplayer['flags'].isSet(PLRF_AI)) {
      pstate = "Done";
    } else if (!pplayer['flags'].isSet(PLRF_AI)
               && pplayer['nturns_idle'] > 1) {
      pstate += "Idle for " + pplayer['nturns_idle'] + " turns";
    } else if (!pplayer['phase_done']
               && !pplayer['flags'].isSet(PLRF_AI)) {
      pstate = "Moving";
    }
    nation_list_html += "<td>" + pstate + "</td>";
    nation_list_html += "</tr>";


  }
  nation_list_html += "</tbody></table>";

  $("#nations_list").html(nation_list_html);
  $(".nation_button").button();

  $("#nation_table").selectable({ filter: "tr",
       selected: function( event, ui ) {handle_nation_table_select(ui); } });

  selected_player = -1;

  if (is_pbem()) {
    /* TODO: PBEM games do not support diplomacy.*/
    $('#meet_player_button').hide();
    $('#cancel_treaty_button').hide();
    $('#take_player_button').hide();
    $('#toggle_ai_button').hide();
    $('#game_scores_button').hide();
  } else if (is_longturn()) {
    $('#take_player_button').hide();
    $('#toggle_ai_button').hide();
    $('#game_scores_button').hide();
  } else {
    $('#view_player_button').button("disable");
    $('#meet_player_button').button("disable");
    $('#cancel_treaty_button').button("disable");
    $('#take_player_button').button("disable");
    $('#toggle_ai_button').button("disable");
  }

  $("#intelligence_report_button").button("disable");

  if (is_small_screen) {
    $('#take_player_button').hide();
  }

  for (var player_id in players) {
    var pplayer = players[player_id];
    var flag_canvas = $('#nation_dlg_flags_' + player_id);
    if (flag_canvas.length > 0) {
      var flag_canvas_ctx = flag_canvas[0].getContext("2d");
      var tag = "f." + nations[pplayer['nation']]['graphic_str'];
      if (flag_canvas_ctx != null && sprites[tag] != null) {
        flag_canvas_ctx.drawImage(sprites[tag], 0, 0);
      }
    }
  }

  if (!is_touch_device()) {
    $("#nation_table").tablesorter({theme: "dark"});
  } else if (is_small_screen()) {
    $("#nations").height( mapview['height'] - 150);
    $("#nations").width( mapview['width']);
  }

}


/**************************************************************************
 ...
**************************************************************************/
function col_love(pplayer)
{
  if (client_is_observer() || client.conn.playing == null || pplayer['playerno'] == client.conn.playing['playerno']
      || pplayer['flags'].isSet(PLRF_AI) == false) {
    return "-";
  } else {
    return love_text(pplayer['love'][client.conn.playing['playerno']]);
  }

}

/**************************************************************************
 ...
**************************************************************************/
function handle_nation_table_select( ui )
{
  selected_player = parseFloat($(ui.selected).data("plrid"));
  var player_id = selected_player;
  var pplayer = players[selected_player];
  if (pplayer == null) return;

  if (pplayer != null && pplayer['is_alive'] && (client_is_observer()
      || (client.conn.playing != null && player_id == client.conn.playing['playerno'])
      || (diplstates[player_id] != null && diplstates[player_id] != DS_NO_CONTACT))) {
    $('#view_player_button').button("enable");
  } else {
    $('#view_player_button').button("disable");
  }

  if (!client_is_observer() && diplstates[player_id] != null
      && diplstates[player_id] != DS_NO_CONTACT) {
    $('#meet_player_button').button("enable");
  } else {
    $('#meet_player_button').button("disable");
  }
  if (!is_hotseat()
      && !pplayer['flags'].isSet(PLRF_AI)
      && (diplstates[player_id] != null && diplstates[player_id] == DS_NO_CONTACT)) {
    $('#meet_player_button').button("disable");
  }

    if (pplayer['flags'].isSet(PLRF_AI) || (client.conn.playing != null && player_id == client.conn.playing['playerno'])) {
      $('#send_message_button').button("disable");
    } else {
      $('#send_message_button').button("enable");
    }

  if (!client_is_observer() && client.conn.playing != null && player_id != client.conn.playing['playerno']
      && diplstates[player_id] != null
      && diplstates[player_id] != DS_WAR && diplstates[player_id] != DS_NO_CONTACT) {
    $('#cancel_treaty_button').button("enable");

  } else {
    $('#cancel_treaty_button').button("disable");
  }
  
  if (!client_is_observer() && client.conn.playing != null && player_id != client.conn.playing['playerno']) {
    if (diplstates[player_id] == DS_CEASEFIRE || diplstates[player_id] == DS_ARMISTICE || diplstates[player_id] == DS_PEACE) {
      $("#cancel_treaty_button").button("option", "label", "Declare war");
    } else {
      $("#cancel_treaty_button").button("option", "label", "Cancel treaty");
    }
  }

  if (!client_is_observer() && client.conn.playing != null && client.conn.playing['gives_shared_vision'].isSet(player_id)) {
    $('#withdraw_vision_button').button("enable");
  } else {
    $('#withdraw_vision_button').button("disable");
  }

  if (!client_is_observer() && client.conn.playing != null && player_id != client.conn.playing['playerno']
    && diplstates[player_id] != DS_NO_CONTACT) {
    $("#intelligence_report_button").button("enable");
  } else {
    $("#intelligence_report_button").button("disable");
  }

  if (!is_hotseat() && client_is_observer() && pplayer['flags'].isSet(PLRF_AI)
      && nations[pplayer['nation']]['is_playable']
               && $.getUrlVar('multi') == "true") {
    $('#take_player_button').button("enable");
  } else {
    $('#take_player_button').button("disable");
  }

  $('#toggle_ai_button').button("enable");

}

/**************************************************************************
 ...
**************************************************************************/
function nation_meet_clicked()
{
  if (selected_player == -1) return;
  diplomacy_init_meeting_req(selected_player);
  set_default_mapview_active();
}

/**************************************************************************
 ...
**************************************************************************/
function cancel_treaty_clicked()
{
  if (selected_player == -1) return;
  diplomacy_cancel_treaty(selected_player);
  set_default_mapview_active();
}

/**************************************************************************
 ...
**************************************************************************/
function withdraw_vision_clicked()
{
  if (selected_player == -1) return;

  var packet = {"pid" : packet_diplomacy_cancel_pact,
                "other_player_id" : selected_player,
                "clause" : CLAUSE_VISION};
  send_request(JSON.stringify(packet));
  set_default_mapview_active();
}

/**************************************************************************
 ...
**************************************************************************/
function take_player_clicked()
{
  if (selected_player == -1) return;
  var pplayer = players[selected_player];
  take_player(pplayer['name']);
  set_default_mapview_active();
}

/**************************************************************************
 ...
**************************************************************************/
function toggle_ai_clicked()
{
  if (selected_player == -1) return;
  var pplayer = players[selected_player];
  aitoggle_player(pplayer['name']);
  set_default_mapview_active();
}

/**************************************************************************
 ...
**************************************************************************/
function get_score_text(player)
{

  if (player['score'] > 0 || client_is_observer()
      || (client.conn.playing != null && player['playerno'] == client.conn.playing['playerno'])) {
    return player['score'];
  } else {
    return "?";
  }

}

/**************************************************************************
  Return a text describing an AI's love for you.  (Oooh, kinky!!)
  These words should be adjectives which can fit in the sentence
  "The x are y towards us"
  "The Babylonians are respectful towards us"
**************************************************************************/
function love_text(love)
{
  if (love <= - MAX_AI_LOVE * 90 / 100) {
    return "Genocidal";
  } else if (love <= - MAX_AI_LOVE * 70 / 100) {
    return "Belligerent";
  } else if (love <= - MAX_AI_LOVE * 50 / 100) {
    return "Hostile";
  } else if (love <= - MAX_AI_LOVE * 25 / 100) {
    return "Uncooperative";
  } else if (love <= - MAX_AI_LOVE * 10 / 100) {
    return "Uneasy";
  } else if (love <= MAX_AI_LOVE * 10 / 100) {
    return "Neutral";
  } else if (love <= MAX_AI_LOVE * 25 / 100) {
    return "Respectful";
  } else if (love <= MAX_AI_LOVE * 50 / 100) {
    return "Helpful";
  } else if (love <= MAX_AI_LOVE * 70 / 100) {
    return "Enthusiastic";
  } else if (love <= MAX_AI_LOVE * 90 / 100) {
    return "Admiring";
  } else {
    return "Worshipful";
  }
}

/**************************************************************************
 ...
**************************************************************************/
function take_player(player_name)
{
  send_message("/take " + player_name.substring(0,3));
  observing = false;
}

/**************************************************************************
 ...
**************************************************************************/
function aitoggle_player(player_name)
{
  send_message("/ai " + player_name.substring(0,3));
  observing = false;
}

/**************************************************************************
 ...
**************************************************************************/
function center_on_player()
{
  if (selected_player == -1) return;

    /* find a city to focus on. */
    for (var city_id in cities) {
      var pcity = cities[city_id];
      if (city_owner_player_id(pcity) == selected_player) {
        center_tile_mapcanvas(city_tile(pcity));
        set_default_mapview_active();
        return;
      }
    }
}

/**************************************************************************
  Send a private message to another human player from the dialog.
  Only called from within the dialog.
**************************************************************************/
function send_private_message(other_player_name)
{
  var message = other_player_name + ": " + encode_message_text($("#private_message_text").val());
  var packet = {"pid" : packet_chat_msg_req,
                "message" : message};
  send_request(JSON.stringify(packet));
  keyboard_input = true;
  $("#dialog").dialog('close');
}

/**************************************************************************
  Show the dialog for sending a private message to another human player.
**************************************************************************/
function show_send_private_message_dialog()
{
  if (selected_player == -1) return;
  var pplayer = players[selected_player];

  if (pplayer == null) {
    swal("Please select a player to send a private message to first.");
    return;
  }

  var name = pplayer['name'];
  keyboard_input = false;

  // reset dialog page.
  $("#dialog").remove();
  $("<div id='dialog'></div>").appendTo("div#game_page");

  var intro_html = "Message: <input id='private_message_text' type='text' size='50' maxlength='80'>";
  $("#dialog").html(intro_html);
  $("#dialog").attr("title", "Send private message to " + name);
  $("#dialog").dialog({
			bgiframe: true,
			modal: true,
			width: is_small_screen() ? "80%" : "40%",
			buttons:
			{
				"Send" : function() {
				  send_private_message(name);
				}
			}
		});


  $("#dialog").dialog('open');


  $('#dialog').keyup(function(e) {
    if (e.keyCode == 13) {
      send_private_message(name);
    }
  });


}
