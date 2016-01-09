/* NSC -- new Scala compiler
 * Copyright 2007-2016 LAMP/EPFL
 * @author  David Bernard, Manohar Jonnalagedda, Felix Mulder
 */

package scala.tools.nsc.doc
package html
package page

import scala.tools.nsc.doc
import scala.tools.nsc.doc.model.{Package, DocTemplateEntity}
import scala.tools.nsc.doc.html.{Page, HtmlFactory}
import scala.util.parsing.json.{JSONObject, JSONArray, JSONType}

class IndexScript(universe: doc.Universe, index: doc.Index) extends Page {
  import model._
  import scala.tools.nsc.doc.base.comment.Text
  import scala.collection.immutable.Map

  def path = List("index.js")

  override def writeFor(site: HtmlFactory) {
    writeFile(site) {
      _.write("Index.PACKAGES = " + packages.toString() + ";")
    }
  }

  val packages = {
    val pairs = allPackagesWithTemplates.toIterable.map(_ match {
      case (pack, templates) => {
        val merged = mergeByQualifiedName(templates)

        val ary = merged.keys.toList.sortBy(_.toLowerCase).map(key => {
          val pairs = merged(key).flatMap { t =>
            Seq(
              kindToString(t) -> relativeLinkTo(t),
              "kind" -> kindToString(t),
              "members" -> membersToJSON(t.members))
          }

          JSONObject(Map(pairs : _*) + ("name" -> key))
        })

        pack.qualifiedName -> JSONArray(ary)
      }
    }).toSeq

    JSONObject(Map(pairs : _*))
  }

  def mergeByQualifiedName(source: List[DocTemplateEntity]) = {
    var result = Map[String, List[DocTemplateEntity]]()

    for (t <- source) {
      val k = t.qualifiedName
      result += k -> (result.getOrElse(k, List()) :+ t)
    }

    result
  }

  def allPackages = {
    def f(parent: Package): List[Package] = {
      parent.packages.flatMap(
        p => f(p) :+ p
      )
    }
    f(universe.rootPackage).sortBy(_.toString)
  }

  def allPackagesWithTemplates = {
    Map(allPackages.map((key) => {
      key -> key.templates.collect {
        case t: DocTemplateEntity if !t.isPackage && !universe.settings.hardcoded.isExcluded(t.qualifiedName) => t
      }
    }) : _*)
  }

  def membersToJSON(entities: List[MemberEntity]): JSONType =
    JSONArray(entities map memberToJSON)

  def memberToJSON: MemberEntity => JSONObject = {
    case d: Def => defToJSON(d)
    case v: Val => valToJSON(v)
    case m: MemberEntity =>
      JSONObject(Map("member" -> m.definitionName,
                     "error" -> "unsupported entity"))
  }

  @inline def defToJSON(d: Def): JSONObject =
    JSONObject(Map(
      "label"  -> d.definitionName.replaceAll(".*#", ""),
      "member" -> d.definitionName.replaceFirst("#", "."),
      "tail"   -> d
        .valueParams //List[List[ValueParam]]
        .map { params =>
          params.map(p => p.name + ": " + p.resultType.name).mkString(", ")
        }
        .mkString("(", ")(", "): " + d.resultType.name),
      "kind"   -> memberKindToString(d),
      "link"   -> memberToUrl(d)))

  @inline def valToJSON(v: Val): JSONObject =
    JSONObject(Map(
      "label"  -> v.definitionName.replaceAll(".*#", ""),
      "member" -> v.definitionName.replaceFirst("#", "."),
      "tail"   -> (": " + v.resultType.name),
      "kind"   -> memberKindToString(v),
      "link"   -> memberToUrl(v)))

  def memberKindToString(mbr: MemberEntity): String = {
    val kind = mbr.flags.map(_.text.asInstanceOf[Text].text).mkString(" ")
    val space = if (kind == "") "" else " "

    kind + space + kindToString(mbr)
  }

  def memberToUrl(mbr: MemberEntity): String = {
    def hashFromPath(templatePath: List[String]): String =
      (templatePath.head.replace(".html", "") :: templatePath.tail)
      .reverse
      .mkString(".")

    val containingTemplatePath = templateToPath(mbr.inTemplate)
    val hash = hashFromPath(containingTemplatePath)
    s"index.html#$hash@" + mbr.signature
  }
}

object IndexScript {
  def apply(universe: doc.Universe, index: doc.Index) =
    new IndexScript(universe, index)
}
