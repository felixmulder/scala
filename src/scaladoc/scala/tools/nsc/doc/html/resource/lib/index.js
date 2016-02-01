// © 2009–2010 EPFL/LAMP
// code by Gilles Dubochet with contributions by Johannes Rudolph, "spiros", Marcin Kubala and Felix Mulder

var scheduler = undefined;

var title = $(document).attr('title');

var lastFragment = "";

$(document).ready(function() {
    $('iframe').bind("load", function(){
        try {
            var subtitle = $(this).contents().find('title').text();
            $(document).attr('title', (title ? title + " - " : "") + subtitle);
        } catch (e) {
            // Chrome doesn't allow reading the iframe's contents when
            // used on the local file system.
        }
        setUrlFragmentFromFrameSrc();
    });

    // workaround for IE's iframe sizing lack of smartness
    if($.browser.msie) {
        function fixIFrame() {
            $('iframe').height($(window).height() )
        }
        $('iframe').bind("load",fixIFrame)
        $('iframe').bind("resize",fixIFrame)
    }

    scheduler = new Scheduler();
    scheduler.addLabel("init", 1);
    scheduler.addLabel("focus", 2);
    scheduler.addLabel("filter", 4);
    scheduler.addLabel("search", 5);

    configureTextFilter();

    setFrameSrcFromUrlFragment();

    // If the url fragment changes, adjust the src of iframe "template".
    $(window).bind('hashchange', function() {
      if(lastFragment != window.location.hash) {
        lastFragment = window.location.hash;
        setFrameSrcFromUrlFragment();
      }
    });

    // Wait until page has loaded until binding input fields, setting fold all
    setTimeout(function() {
      $("#index-input").on("focus", function() {
          $("#textfilter > .input > .clear").show();
      });

      $("#index-input").on("blur", function() {
          setTimeout(function() {
              $("#textfilter > .input > .clear").hide();
          }, 10);
      });
    }, 1500);
});

// Set the iframe's src according to the fragment of the current url.
// fragment = "#scala.Either" => iframe url = "scala/Either.html"
// fragment = "#scala.Either@isRight:Boolean" => iframe url = "scala/Either.html#isRight:Boolean"
// fragment = "#scalaz.iteratee.package@>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]" => iframe url = "scalaz/iteratee/package.html#>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]"
function setFrameSrcFromUrlFragment() {

    function extractLoc(fragment) {
        var loc = fragment.split('@')[0].replace(/\./g, "/");
        if (loc.indexOf(".html") < 0) {
            loc += ".html";
        }
        return loc;
    }

    function extractMemberSig(fragment) {
        var splitIdx = fragment.indexOf('@');
        if (splitIdx < 0) {
            return;
        }
        return fragment.substr(splitIdx + 1);
    }

    var fragment = location.hash.slice(1);
    if (fragment) {
        var locWithMemeberSig = extractLoc(fragment);
        var memberSig = extractMemberSig(fragment);
        if (memberSig) {
            locWithMemeberSig += "#" + memberSig;
        }
        frames["template"].location.replace(location.protocol + locWithMemeberSig);
    } else {
        console.log("empty fragment detected");
        frames["template"].location.replace("package.html");
    }
}

// Set the url fragment according to the src of the iframe "template".
// iframe url = "scala/Either.html"  =>  url fragment = "#scala.Either"
// iframe url = "scala/Either.html#isRight:Boolean"  =>  url fragment = "#scala.Either@isRight:Boolean"
// iframe url = "scalaz/iteratee/package.html#>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]" => fragment = "#scalaz.iteratee.package@>@>[E,A]=scalaz.iteratee.package.Iteratee[E,A]"
function setUrlFragmentFromFrameSrc() {
  try {
    var commonLength = location.pathname.lastIndexOf("/");
    var frameLocation = frames["template"].location;
    var relativePath = frameLocation.pathname.slice(commonLength + 1);

    if(!relativePath || frameLocation.pathname.indexOf("/") < 0)
      return;

    // Add #, remove ".html" and replace "/" with "."
    fragment = "#" + relativePath.replace(/\.html$/, "").replace(/\//g, ".");

    // Add the frame's hash after an @
    if(frameLocation.hash) fragment += ("@" + frameLocation.hash.slice(1));

    // Use replace to not add history items
    lastFragment = fragment;
    location.replace(fragment);
  }
  catch(e) {
    // Chrome doesn't allow reading the iframe's location when
    // used on the local file system.
  }
}

var Index = {};

(function (ns) {
    ns.keys = function (obj) {
        var result = [];
        var key;
        for (key in obj) {
            result.push(key);
        }
        return result;
    }
})(Index);

/* Handles all key presses while scrolling around with keyboard shortcuts in search results */
function handleKeyNavigation() {
    /** Iterates both back and forth among selected elements */
    var EntityIterator = function (litems, ritems) {
        var it = this;
        this.index = -1;

        this.items = litems;
        this.litems = litems;
        this.ritems = ritems;

        /** Returns the next entry - if trying to select past last element, it
         * returns the last element
         */
        it.next = function() {
            it.index = Math.min(it.items.length - 1, it.index + 1);
            return $(it.items[it.index]);
        };

        /** Returns the previous entry - will return `undefined` instead if
         * selecting up from first element
         */
        it.prev = function() {
            it.index = Math.max(-1, it.index - 1);
            return it.index == -1 ? undefined : $(it.items[it.index]);
        };

        it.right = function() {
            it.items = it.ritems;
            it.index = Math.min(it.index, it.items.length - 1);
            return $(it.items[it.index]);
        };

        it.left = function() {
            it.items = it.litems;
            it.index = Math.min(it.index, it.items.length - 1);
            return $(it.items[it.index]);
        };
    };

    /** Scroll helper, ensures that the selected elem is inside the viewport */
    var Scroller = function ($container) {
        scroller = this;
        scroller.container = $container;

        scroller.scrollDown = function($elem) {
            var yPos = $elem.offset().top; // offset relative to viewport
            if ($container.height() < yPos) {
                $container.animate({
                    scrollTop: $container.scrollTop() + yPos - $("#search").height() - 10
                }, 200);
            }
        };

        scroller.scrollUp = function ($elem) {
            var yPos = $elem.offset().top; // offset relative to viewport
            if (yPos < $("#search").height()) {
                $container.animate({
                    scrollTop: $container.scrollTop() + yPos - $("#search").height() - 10
                }, 200);
            }
        };

        scroller.scrollTop = function() {
            $container.animate({
                scrollTop: 0
            }, 200);
        }
    };

    scheduler.add("init", function() {
        $("#textfilter input").blur();
        var items = new EntityIterator(
            $("div#results-content > div#entity-results > ul.entities span.entity > a").toArray(),
            $("div#results-content > div#member-results > ul.entities span.entity > a").toArray()
        );

        var scroller = new Scroller($("#search-results"));

        var $old = items.next();
        $old.addClass("selected");

        $(window).bind("keydown", function(e) {
            switch ( e.keyCode ) {
            case 9: // tab
                $old.removeClass("selected");
                break;

            case 13: // enter
                var href = $old.attr("href");
                location.replace(href);
                $old.click();
                $("#textfilter input").attr("value", "");
                break;

            case 37: // left
                var oldTop = $old.offset().top;
                $old.removeClass("selected");
                $old = items.left();
                $old.addClass("selected");

                (oldTop - $old.offset().top < 0 ? scroller.scrollDown : scroller.scrollUp)($old);
                break;

            case 38: // up
                $old.removeClass('selected');
                $old = items.prev();

                if ($old === undefined) { // scroll past top
                    $(window).unbind("keydown");
                    $("#textfilter input").focus();
                    scroller.scrollTop();
                    return false;
                } else {
                    $old.addClass("selected");
                    scroller.scrollUp($old);
                }
                break;

            case 39: // right
                var oldTop = $old.offset().top;
                $old.removeClass("selected");
                $old = items.right();
                $old.addClass("selected");

                (oldTop - $old.offset().top < 0 ? scroller.scrollDown : scroller.scrollUp)($old);
                break;

            case 40: // down
                $old.removeClass("selected");
                $old = items.next();
                $old.addClass("selected");
                scroller.scrollDown($old);
                break;
            }
        });
    });
}

/* Configures the text filter  */
function configureTextFilter() {
    scheduler.add("init", function() {
        var input = $("#textfilter input");
        input.bind('keyup', function(event) {
            switch ( event.keyCode ) {
                case 27: // escape
                    input.attr("value", "");
                    $("div#search-results").hide();
                    $("#search > span.close-results").hide();
                    $("#search > span#doc-title").show();
                    break;

                case 38: // up arrow
                    return false;

                case 40: // down arrow
                    $(window).unbind("keydown");
                    handleKeyNavigation();
                    return false;
            }

            searchAll();
        });
    });
    scheduler.add("init", function() {
        $("#textfilter > .input > .clear").click(function() {
            $("#textfilter input").attr("value", "");
            $("div#search-results").hide();
            $("#search > span.close-results").hide();
            $("#search > span#doc-title").show();
        });
    });

    scheduler.add("init", function() {
        $("div#search > span.close-results").click(function() {
            $("div#search-results").hide();
            $("#search > span.close-results").hide();
            $("#search > span#doc-title").show();
            $("#textfilter input").attr("value", "");
        });
    });
}

function compilePattern(query) {
    var escaped = query.replace(/([\.\*\+\?\|\(\)\[\]\\])/g, '\\$1');

    if (query.toLowerCase() != query) {
        // Regexp that matches CamelCase subbits: "BiSe" is
        // "[a-z]*Bi[a-z]*Se" and matches "BitSet", "ABitSet", ...
        return new RegExp(escaped.replace(/([A-Z])/g,"[a-z]*$1"));
    }
    else { // if query is all lower case make a normal case insensitive search
        return new RegExp(escaped, "i");
    }
}

/** Searches packages for entites matching the search query using a regex
 *
 * @param {[Object]} pack: package being searched
 * @param {RegExp} regExp: a regular expression for finding matching entities
 */
function searchPackage(pack, regExp) {
    scheduler.add("search", function() {
        var entities = Index.PACKAGES[pack];
        var matched = [];
        var notMatching = [];

        scheduler.add("search", function() {
            searchMembers(entities, regExp, pack);
        });

        entities.forEach(function (elem) {
            regExp.test(elem.name) ? matched.push(elem) : notMatching.push(elem);
        });

        var results = {
            "matched": matched,
            "package": pack
        };

        scheduler.add("search", function() {
            handleSearchedPackage(results, regExp);
        });
    });
}

function searchMembers(entities, regExp, pack) {
    var memDiv = document.getElementById("member-results");
    var h1 = document.createElement("h1");
    h1.className = "package";
    h1.appendChild(document.createTextNode(pack));
    h1.style.display = "none";
    memDiv.appendChild(h1);

    var entityUl = document.createElement("ul");
    entityUl.className = "entities";
    memDiv.appendChild(entityUl);

    entities.forEach(function(entity) {
        var entityLi = document.createElement("li");

        var iconElem = document.createElement("div");
        iconElem.className = "icon " + entity.kind;
        entityLi.appendChild(iconElem);

        var name = entity.name.split('.').pop()
        var nameElem = document.createElement("span");
        nameElem.className = "entity";

        var entityUrl = document.createElement("a");
        entityUrl.title = name;
        entityUrl.href = "#" + entity.name;

        if (entity.kind == "object")
            entityUrl.href += "$";

        entityUrl.appendChild(document.createTextNode(name));

        $(entityUrl).click(function() {
            $("div#search-results").hide();
            $("#search > span.close-results").hide();
            $("#search > span#doc-title").show();
            $("#textfilter input").attr("value", "");
        });

        nameElem.appendChild(entityUrl);
        entityLi.appendChild(nameElem);

        var membersUl = document.createElement("ul");
        membersUl.className = "members";
        entityLi.appendChild(membersUl);


        searchEntity(entity, membersUl, regExp)
            .then(function(res) {
                if (res.length > 0) {
                    h1.style.display = "block";
                    entityUl.appendChild(entityLi);
                }
            });
    });
}

/** This function inserts `li` into the `ul` ordered by the li's id
 *
 * @param {Node} ul: the list in which to insert `li`
 * @param {Node} li: item to insert
 */
function insertSorted(ul, li) {
    var lis = ul.childNodes;
    var beforeLi = null;

    for (var i = 0; i < lis.length; i++) {
        if (lis[i].id > li.id)
            beforeLi = lis[i];
    }

    // if beforeLi == null, it will be inserted last
    ul.insertBefore(li, beforeLi);
}

/** Defines the callback when a package has been searched and searches its
 * members
 *
 * It will search all entities which matched the regExp.
 *
 * @param {Object} res: this is the searched package. It will contain the map
 * from the `searchPackage`function.
 * @param {RegExp} regExp
 */
function handleSearchedPackage(res, regExp) {
    $("div#search-results").show();
    $("#search > span.close-results").show();
    $("#search > span#doc-title").hide();

    var searchRes = document.getElementById("results-content");
    var entityDiv = document.getElementById("entity-results");

    var h1 = document.createElement("h1");
    h1.className = "package";
    h1.appendChild(document.createTextNode(res.package));

    if (res.matched.length == 0)
        h1.style.display = "none";

    entityDiv.appendChild(h1);

    var ul = document.createElement("ul")
    ul.className = "entities";

    // Generate html list items from results
    res.matched
       .map(function(entity) { return listItem(entity, regExp); })
       .forEach(function(li) { ul.appendChild(li); });

    entityDiv.appendChild(ul);
}

/** Searches an entity asynchronously for regExp matches in an entity's members
 *
 * @param {Object} entity: the entity to be searched
 * @param {Node} ul: the list in which to insert the list item created
 * @param {RegExp} regExp
 */
function searchEntity(entity, ul, regExp) {
    return new Promise(function(resolve, reject) {
        var matchingMembers = $.grep(entity.members, function(member, i) {
            return regExp.test(member.label);
        });

        resolve(matchingMembers);
    })
    .then(function(res) {
        res.forEach(function(elem) {
            var kind = document.createElement("span");
            kind.className = "kind";
            kind.appendChild(document.createTextNode(elem.kind));

            var label = document.createElement("a");
            label.title = elem.label;
            label.href = elem.link;
            label.className = "label";
            label.appendChild(document.createTextNode(elem.label));

            $(label).click(function() {
                $("div#search-results").hide();
                $("#search > span.close-results").hide();
                $("#search > span#doc-title").show();
                $("#textfilter input").attr("value", "");
            });

            var tail = document.createElement("span");
            tail.className = "tail";
            tail.appendChild(document.createTextNode(elem.tail));

            var li = document.createElement("li");
            li.appendChild(kind);
            li.appendChild(label);
            li.appendChild(tail);

            ul.appendChild(li);
        });
        return res;
    });
}

/** Creates a list item representing an entity
 *
 * @param {Object} entity, the searched entity to be displayed
 * @param {RegExp} regExp
 * @return {Node} list item containing entity
 */
function listItem(entity, regExp) {
    var name = entity.name.split('.').pop()
    var nameElem = document.createElement("span");
    nameElem.className = "entity";

    var entityUrl = document.createElement("a");
    entityUrl.title = name;
    entityUrl.href = "#" + entity.name;

    if (entity.kind == "object")
        entityUrl.href += "$";

    entityUrl.appendChild(document.createTextNode(name));

    $(entityUrl).click(function() {
        $("div#search-results").hide();
        $("#search > span.close-results").hide();
        $("#search > span#doc-title").show();
        $("#textfilter input").attr("value", "");
    });

    nameElem.appendChild(entityUrl);

    var iconElem = document.createElement("div");
    iconElem.className = "icon " + entity.kind;

    var li = document.createElement("li");
    li.id = entity.name.replace(new RegExp("\\.", "g"),"-");
    li.appendChild(iconElem);
    li.appendChild(nameElem);

    var ul = document.createElement("ul");
    ul.className = "members";

    li.appendChild(ul);

    return li;
}

/** Searches all packages and entities for the current search string in
 *  the input field "#textfilter"
 *
 * Then shows the results in div#search-results
 */
function searchAll() {
    scheduler.clear("search"); // clear previous search
    var searchStr = $("#textfilter input").attr("value").trim() || '';

    if (searchStr === '') {
        $("div#search-results").hide();
        $("#search > span.close-results").hide();
        $("#search > span#doc-title").show();
        return;
    }

    $("div#results-content > span.search-text").remove();

    var memberResults = document.getElementById("member-results");
    memberResults.innerHTML = "";
    var memberH1 = document.createElement("h1");
    memberH1.className = "result-type";
    memberH1.innerHTML = "Member results";
    memberResults.appendChild(memberH1);

    var entityResults = document.getElementById("entity-results");
    entityResults.innerHTML = "";
    var entityH1 = document.createElement("h1");
    entityH1.className = "result-type";
    entityH1.innerHTML = "Entity results";
    entityResults.appendChild(entityH1);

    $("div#results-content")
        .prepend("<span class='search-text'>"
                +"  Showing results for <span class='query-str'>\"" + searchStr + "\"</span>"
                +"</span>");

    var regExp = compilePattern(searchStr);

    // Search for all entities matching query
    Index
        .keys(Index.PACKAGES)
        .sort()
        .forEach(function(elem) { searchPackage(elem, regExp); })
}

/** Check if user agent is associated with a known mobile browser */
function isMobile() {
    return /Android|webOS|Mobi|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
