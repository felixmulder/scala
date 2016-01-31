/* NSC -- new Scala compiler
 * Copyright 2007-2013 LAMP/EPFL
 * @author  David Bernard, Manohar Jonnalagedda, Felix Mulder
 */

package scala.tools.nsc
package doc
package html
package page

import model._
import scala.collection._
import scala.xml._

class Index(universe: doc.Universe, val index: doc.Index) extends HtmlPage {

  def path = List("index.html")

  def title = {
    val s = universe.settings
    ( if (!s.doctitle.isDefault) s.doctitle.value else "" ) +
    ( if (!s.docversion.isDefault) (" " + s.docversion.value) else "" )
  }

  val headers =
    <xml:group>
      <link href={ relativeLinkTo{List("index.css", "lib")} }  media="screen" type="text/css" rel="stylesheet"/>
      <script type="text/javascript" src={ relativeLinkTo{List("jquery.js", "lib")} }></script>
      <script type="text/javascript" src={ relativeLinkTo{List("index.js", "lib")} }></script>
      <script type="text/javascript" src="index.js"></script>
      <script type="text/javascript" src={ relativeLinkTo{List("scheduler.js", "lib")} }></script>
    </xml:group>

  val body =
    <body>
      { search }
      <div id="search-results">
        <div id="results-content">
          <div id="entity-results"></div>
          <div id="member-results"></div>
        </div>
      </div>
      <div id="content">
        <iframe id="template" name="template" src={ relativeLinkTo{List("package.html")} }/>
      </div>
    </body>

  def letters: NodeSeq =
    '_' +: ('a' to 'z') map {
      char => {
        val label = if (char == '_') '#' else char.toUpper

        index.firstLetterIndex.get(char) match {
          case Some(_) =>
            <a target="template" href={ "index/index-" + char + ".html" }>{
              label
            }</a>
          case None => <span>{ label }</span>
        }
      }
    }

  def deprecated: NodeSeq = if (index.hasDeprecatedMembers)
      <a target="template" href="deprecated-list.html">deprecated</a>
    else
      <span>deprecated</span>

  def search =
    <xml:group>
      <div id="search">
          <span id="doc-title">{universe.settings.doctitle.value}</span>
          <span class="close-results"><span class="left">&lt;</span> Back</span>
          <div id="textfilter">
            <span class="input">
              <input placeholder="Search" id="index-input" type="text" accesskey="/"/>
              <span class="clear">✖</span>
            </span>
          </div>
      </div>
    </xml:group>

  def packageQualifiedName(ety: DocTemplateEntity): String =
    if (ety.inTemplate.isPackage) ety.name
    else (packageQualifiedName(ety.inTemplate) + "." + ety.name)

}
